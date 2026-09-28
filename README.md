# Cluster MongoDB shardé et répliqué avec Docker

Déploiement local d'un **cluster MongoDB 7 distribué** (sharding + réplication) avec **Docker Compose** : 13 conteneurs, 3 shards répliqués, un replica set de serveurs de configuration et un routeur `mongos`. Le projet inclut un jeu de 11 000 étudiants, des scripts CRUD adaptés au sharding et des **tests de tolérance aux pannes**.

---

## Architecture

```
                        Client (mongosh / appli)
                                  │  :27017
                           ┌──────▼──────┐
                           │   mongos    │  routeur de requêtes
                           └──────┬──────┘
                                  │
               ┌──────────────────┴──────────────────┐
               │   Config Server RS (configReplSet)  │  métadonnées du cluster
               │    config1 · config2 · config3      │
               └──────────────────┬──────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
 ┌──────▼──────┐          ┌───────▼─────┐          ┌───────▼─────┐
 │  shard1RS   │          │  shard2RS   │          │  shard3RS   │
 │ 1a · 1b · 1c│          │ 2a · 2b · 2c│          │ 3a · 3b · 3c│
 └─────────────┘          └─────────────┘          └─────────────┘
   PRIMARY + 2 SECONDARY par shard (réplication)
```

| Composant | Conteneurs | Rôle |
|---|---|---|
| Config servers | `config1`, `config2`, `config3` | Stockent les métadonnées (répartition des chunks) |
| Shards | `shard1a…c`, `shard2a…c`, `shard3a…c` | Stockent les données, chacun répliqué sur 3 nœuds |
| Routeur | `mongos` | Point d'entrée unique, exposé sur le port **27017** |

Tous les conteneurs utilisent l'image `mongo:7`, partagent le réseau `mongo-net` et ont chacun un volume persistant. Le dossier `scripts/` est monté dans `mongos` sous `/data`.

---

## Structure

```
mongodb_sharding_single_docker/
├── docker-compose.yaml
├── README.md
├── log.txt                              # Trace d'une exécution du script CRUD
└── scripts/
    ├── etudiants3.json                  # 11 000 étudiants (générés avec Mockaroo)
    ├── mongodb_crud_script.js           # CRUD de base (version non shardée)
    ├── mongodb_crud_script 1.js         # Version intermédiaire
    └── mongodb_crud_script_modifie.js   # ✅ Version compatible sharding (à utiliser)
```

---

## Prérequis

- Docker et Docker Compose
- ~4 Go de RAM disponibles (13 instances `mongod`/`mongos`)

---

## Mise en route

### 1. Démarrer les conteneurs

```bash
docker compose up -d
docker ps
```

### 2. Initialiser le replica set des config servers

```bash
docker exec -it config1 mongosh
```

```js
rs.initiate({
  _id: "configReplSet",
  configsvr: true,
  members: [
    { _id: 0, host: "config1:27017" },
    { _id: 1, host: "config2:27017" },
    { _id: 2, host: "config3:27017" }
  ]
})
rs.status()
```

### 3. Initialiser les trois shards

Répéter pour `shard1a`, `shard2a` et `shard3a` en adaptant le numéro :

```bash
docker exec -it shard1a mongosh
```

```js
rs.initiate({
  _id: "shard1RS",
  members: [
    { _id: 0, host: "shard1a:27017" },
    { _id: 1, host: "shard1b:27017" },
    { _id: 2, host: "shard1c:27017" }
  ]
})
rs.status()
```

### 4. Déclarer les shards auprès du routeur

```bash
docker exec -it mongos mongosh
```

```js
sh.addShard("shard1RS/shard1a:27017,shard1b:27017,shard1c:27017")
sh.addShard("shard2RS/shard2a:27017,shard2b:27017,shard2c:27017")
sh.addShard("shard3RS/shard3a:27017,shard3b:27017,shard3c:27017")
sh.status()
```

### 5. Activer le sharding et importer les données

```js
use gestion_promotion
sh.enableSharding("gestion_promotion")
db.etudiants.createIndex({ id: 1 })
sh.shardCollection("gestion_promotion.etudiants", { id: "hashed" })
```

```bash
docker exec -it mongos mongoimport \
  --db gestion_promotion --collection etudiants \
  --file /data/etudiants3.json --jsonArray
```

### 6. Vérifier la répartition

```js
use gestion_promotion
db.etudiants.countDocuments()          // 11000
db.etudiants.getShardDistribution()    // répartition entre les 3 shards
```

La clé de sharding **hachée** sur `id` répartit les documents de façon homogène entre les shards.

---

## Script CRUD

```js
// depuis mongosh connecté à mongos
load("/data/mongodb_crud_script_modifie.js")
```

Le script enchaîne :

1. **Configuration** : activation du sharding, index, liste des shards
2. **Create** : `insertOne`, `insertMany`
3. **Read** : filtres, regex, projections, tris, comptages
4. **Update** et **Delete** compatibles sharding
5. **Agrégations** : statistiques, regroupements, jointure `$lookup` avec une collection `notes`
6. **Gestion des index** et vérifications finales

> 💡 **Pourquoi une version « modifiée » ?** Sur une collection shardée, un `updateOne` / `deleteOne` doit cibler un seul shard : le filtre doit contenir `_id` ou la clé de sharding. `log.txt` montre l'erreur `MongoServerError: A {multi:false} update on a sharded collection must contain an exact match on _id…` obtenue avec le script d'origine ; `mongodb_crud_script_modifie.js` corrige ce point.

---

## Chunks et balancer (optionnel)

Si la collection ne se répartit pas automatiquement :

```js
sh.splitAt("gestion_promotion.etudiants", { id: 4000 })
sh.splitAt("gestion_promotion.etudiants", { id: 8000 })
sh.startBalancer()

sh.moveChunk("gestion_promotion.etudiants", { id: 1 },    "shard1RS")
sh.moveChunk("gestion_promotion.etudiants", { id: 5000 }, "shard3RS")
```

> `splitAt` et `moveChunk` avec des bornes sur `id` s'appliquent à une clé de sharding **à intervalles** (`{ id: 1 }`). Avec une clé **hachée**, la répartition est automatique et ces commandes sont rarement nécessaires.

---

## Tests de tolérance aux pannes

| Test | Commande | Comportement attendu |
|---|---|---|
| Arrêt d'un SECONDARY | `docker stop shard1b` | Le shard reste disponible en lecture et en écriture |
| Arrêt du PRIMARY | `docker stop shard1a` | Un SECONDARY est **élu** PRIMARY automatiquement (vérifier avec `rs.status()` sur `shard1c`) |
| Arrêt d'un config server | `docker stop config2` | Le cluster continue de fonctionner (2 config servers sur 3 = majorité) |
| Arrêt du routeur | `docker stop mongos` puis `docker start mongos` | Les clients perdent l'accès tant que `mongos` est arrêté ; les données restent intactes |

Pour relancer un nœud : `docker start <conteneur>`. Il rejoint le replica set et se resynchronise.

---

## Arrêt et nettoyage

```bash
docker compose down        # arrête les conteneurs, conserve les données
docker compose down -v     # supprime aussi les volumes
```

---

## Données

`etudiants3.json` contient 11 000 étudiants fictifs générés avec [Mockaroo](https://www.mockaroo.com/) : `id`, `prenom`, `nom`, `email`, `date_naissance`, `telephone`, `promotion_id`.

> ⚠️ Pour 1 000 documents, le champ `date_naissance` contient un message d'erreur de génération (`"Syntax error in formula…"`) au lieu d'une date. À régénérer ou à nettoyer avant de faire des requêtes sur les dates.

---

## Technologies

MongoDB 7 · Docker · Docker Compose · mongosh · JavaScript

## Auteur

**Ryan Kounga** — [@KoungaRyan](https://github.com/KoungaRyan)
