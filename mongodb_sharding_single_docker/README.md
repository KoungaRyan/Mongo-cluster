
## Architecture finale
```
Client
  |
mongos
  |
Config Server RS (config1, config2, config3)
  |
------------------------------------------------
|              |               |
Shard1 RS     Shard2 RS       Shard3 RS
(3 nodes)     (3 nodes)       (3 nodes)

```

## Démarrage du cluster
```
docker compose up -d
docker ps
```
## Initialisation des Config Servers
```
docker exec -it config1 mongosh

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

## Initialisation des Shards

### Shard 1
```
docker exec -it shard1a mongosh

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
### Shard 2
```
docker exec -it shard2a mongosh

rs.initiate({
  _id: "shard2RS",
  members: [
    { _id: 0, host: "shard2a:27017" },
    { _id: 1, host: "shard2b:27017" },
    { _id: 2, host: "shard2c:27017" }
  ]
})


rs.status()
```
### Shard 3
```
docker exec -it shard3a mongosh

rs.initiate({
  _id: "shard3RS",
  members: [
    { _id: 0, host: "shard3a:27017" },
    { _id: 1, host: "shard3b:27017" },
    { _id: 2, host: "shard3c:27017" }
  ]
})

rs.status()

```

## Ajout des shards au cluster

```
docker exec -it mongos mongosh

sh.addShard("shard1RS/shard1a:27017,shard1b:27017,shard1c:27017")
sh.addShard("shard2RS/shard2a:27017,shard2b:27017,shard2c:27017")
sh.addShard("shard3RS/shard3a:27017,shard3b:27017,shard3c:27017")

sh.status()
```

## Activation du sharding & insertion de données
```
docker exec -it mongos mongosh
```

### Insertion du fichier js
```
load("/data/mongodb_crud_script.js")

```
 
### Rendre le script accessible au conteneur
```
docker cp scripts/mongo_crud_script.js mongos:/mongo_crud_script.js
```

### Insertion du fichier JSON
```

use gestion_promotion

sh.enableSharding("gestion_promotion")

db.etudiants.createIndex({ id: 1 })

sh.shardCollection("gestion_promotion.etudiants", { id: "hashed" })


docker exec -it mongos mongoimport --db gestion_promotion --collection etudiants --file /data/etudiants3.json --jsonArray


```

### Controler l'insertion
```
use gestion_promotion
db.etudiants.countDocuments()
sh.status()
```

### Vérifier la distribution
```
db.etudiants.getShardDistribution()
```

## Optionel si la collection ne se shard pas autonatiquement
### Créer manuellement des chunks
```
sh.splitAt(
  "gestion_promotion.etudiants",
  { id: 4000 }
)

sh.splitAt(
  "gestion_promotion.etudiants",
  { id: 8000 }
)
```

### Lancer le balancer
```
sh.startBalancer()
```

### Force une migration manuelle
```
sh.moveChunk(
  "gestion_promotion.etudiants",
  { id: 1 },
  "shard1RS"
)

sh.moveChunk(
  "gestion_promotion.etudiants",
  { id: 5000 },
  "shard3RS"
)
```

### Vérifier la distribution
```
db.etudiants.getShardDistribution()
```



## TESTS DE TOLÉRANCE AUX PANNES

### Test 1 — arrêt d’un SECONDARY
```
docker stop shard1b


sh.status()
```

### Test 2 — arrêt du PRIMARY
```
docker stop shard1a
```

```
docker exec -it shard1c mongosh
rs.status()

```

### Test 3 — arrêt d’un Config Server
```
docker stop config2

sh.status()

```

### Test 4 — arrêt du mongos
```
docker stop mongos
docker start mongos

```