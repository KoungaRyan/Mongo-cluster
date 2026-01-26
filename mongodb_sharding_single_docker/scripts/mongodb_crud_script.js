// ====================================================================
// SCRIPT CRUD ET INTERROGATION - GESTION PROMOTION (MongoDB)
// ====================================================================
// Base de données : gestion_promotion
// Collections : etudiants, notes
// ====================================================================

// Connexion à la base de données
const db = db.getSiblingDB("gestion_promotion");

// Activation du sharding
sh.enableSharding("gestion_promotion");

// Création de l'index shard key
db.etudiants.createIndex({ nom: 1 });

// Sharding de la collection
sh.shardCollection("gestion_promotion.etudiants", { nom: 1 });

// Nettoyage si relancé
db.etudiants.deleteMany({});

// ====================================================================
// 1. CREATE - Opérations d'insertion
// ====================================================================

print("\n=== OPÉRATIONS CREATE ===\n");

// Insérer un seul étudiant
db.etudiants.insertOne({
    nom: "Dupont",
    prenom: "Marie",
    email: "marie.dupont@email.com",
    date_naissance: new Date("2000-05-15"),
    adresse: {
        rue: "12 rue de la République",
        ville: "Bordeaux",
        code_postal: "33000"
    },
    telephone: "0601020304",
    inscriptions: [
        {
            id_promotion: ObjectId(),
            annee_inscription: 2023,
            statut: "actif"
        }
    ]
});

print("✓ Un étudiant inséré");

// Insérer plusieurs étudiants
db.etudiants.insertMany([
    {
        nom: "Martin",
        prenom: "Pierre",
        email: "pierre.martin@email.com",
        date_naissance: new Date("1999-08-20"),
        adresse: {
            rue: "45 avenue des Champs",
            ville: "Talence",
            code_postal: "33400"
        },
        telephone: "0602030405",
        inscriptions: []
    },
    {
        nom: "Bernard",
        prenom: "Sophie",
        email: "sophie.bernard@email.com",
        date_naissance: new Date("2001-03-10"),
        adresse: {
            rue: "78 boulevard Victor Hugo",
            ville: "Pessac",
            code_postal: "33600"
        },
        telephone: "0603040506",
        inscriptions: []
    }
]);

print("✓ Plusieurs étudiants insérés\n");

// ====================================================================
// 2. READ - Opérations de lecture/interrogation
// ====================================================================

print("=== OPÉRATIONS READ ===\n");

// Afficher tous les étudiants (limité à 5)
print("--- Tous les étudiants (5 premiers) ---");
db.etudiants.find().limit(5).pretty();

// Rechercher un étudiant par nom
print("\n--- Recherche par nom (Dupont) ---");
db.etudiants.find({ nom: "Dupont" }).pretty();

// Rechercher par email
print("\n--- Recherche par email ---");
db.etudiants.find({ email: "marie.dupont@email.com" }).pretty();

// Rechercher par ville
print("\n--- Étudiants de Bordeaux ---");
db.etudiants.find({ "adresse.ville": "Bordeaux" }).pretty();

// Rechercher les étudiants nés après une certaine date
print("\n--- Étudiants nés après 2000 ---");
db.etudiants.find({ 
    date_naissance: { $gte: new Date("2000-01-01") } 
}).pretty();

// Projection : afficher uniquement certains champs
print("\n--- Nom, prénom et email uniquement ---");
db.etudiants.find(
    {},
    { nom: 1, prenom: 1, email: 1, _id: 0 }
).limit(10);

// Recherche avec regex (recherche partielle)
print("\n--- Étudiants dont le nom commence par 'Dup' ---");
db.etudiants.find({ nom: /^Dup/i }).pretty();

// Rechercher les étudiants avec des inscriptions
print("\n--- Étudiants ayant au moins une inscription ---");
db.etudiants.find({ 
    "inscriptions.0": { $exists: true } 
}).pretty();

// Trier les résultats
print("\n--- Étudiants triés par nom (ordre alphabétique) ---");
db.etudiants.find({}, { nom: 1, prenom: 1, _id: 0 })
    .sort({ nom: 1 })
    .limit(10);

// Compter le nombre d'étudiants
print("\n--- Nombre total d'étudiants ---");
print("Total: " + db.etudiants.countDocuments());

// Compter avec un filtre
print("\n--- Nombre d'étudiants à Bordeaux ---");
print("Total: " + db.etudiants.countDocuments({ "adresse.ville": "Bordeaux" }));

// ====================================================================
// 3. UPDATE - Opérations de mise à jour
// ====================================================================

print("\n=== OPÉRATIONS UPDATE ===\n");

// Mettre à jour un seul document
db.etudiants.updateOne(
    { email: "marie.dupont@email.com" },
    { 
        $set: { 
            telephone: "0607080910",
            "adresse.code_postal": "33100"
        } 
    }
);
print("✓ Téléphone et code postal mis à jour pour Marie Dupont");

// Mettre à jour plusieurs documents
db.etudiants.updateMany(
    { "adresse.ville": "Bordeaux" },
    { 
        $set: { region: "Nouvelle-Aquitaine" } 
    }
);
print("✓ Région ajoutée pour tous les étudiants de Bordeaux");

// Ajouter un élément à un tableau (inscription)
db.etudiants.updateOne(
    { email: "pierre.martin@email.com" },
    {
        $push: {
            inscriptions: {
                id_promotion: ObjectId(),
                annee_inscription: 2024,
                statut: "actif"
            }
        }
    }
);
print("✓ Inscription ajoutée pour Pierre Martin");

// Incrémenter une valeur (exemple avec un champ numérique)
db.etudiants.updateOne(
    { email: "marie.dupont@email.com" },
    { 
        $inc: { nombre_absences: 1 } 
    }
);
print("✓ Nombre d'absences incrémenté\n");

// ====================================================================
// 4. DELETE - Opérations de suppression
// ====================================================================

print("=== OPÉRATIONS DELETE ===\n");

// Supprimer un document par email
db.etudiants.deleteOne({ email: "sophie.bernard@email.com" });
print("✓ Sophie Bernard supprimée");

// Supprimer plusieurs documents
db.etudiants.deleteMany({ 
    "adresse.ville": "Pessac",
    date_naissance: { $lt: new Date("2000-01-01") }
});
print("✓ Étudiants de Pessac nés avant 2000 supprimés\n");

// ====================================================================
// 5. REQUÊTES AVANCÉES ET AGRÉGATIONS
// ====================================================================

print("=== REQUÊTES AVANCÉES ===\n");

// Agrégation : Compter les étudiants par ville
print("--- Nombre d'étudiants par ville ---");
db.etudiants.aggregate([
    {
        $group: {
            _id: "$adresse.ville",
            nombre_etudiants: { $sum: 1 }
        }
    },
    { $sort: { nombre_etudiants: -1 } }
]);

// Agrégation : Âge moyen des étudiants
print("\n--- Âge moyen des étudiants ---");
db.etudiants.aggregate([
    {
        $project: {
            age: {
                $divide: [
                    { $subtract: [new Date(), "$date_naissance"] },
                    365 * 24 * 60 * 60 * 1000
                ]
            }
        }
    },
    {
        $group: {
            _id: null,
            age_moyen: { $avg: "$age" }
        }
    }
]);

// Jointure avec la collection notes
print("\n--- Étudiants avec leurs notes (lookup) ---");
db.etudiants.aggregate([
    {
        $lookup: {
            from: "notes",
            localField: "_id",
            foreignField: "id_etudiant",
            as: "notes_obtenues"
        }
    },
    {
        $project: {
            nom: 1,
            prenom: 1,
            nombre_notes: { $size: "$notes_obtenues" }
        }
    },
    { $limit: 5 }
]);

// Recherche full-text (nécessite un index texte)
// db.etudiants.createIndex({ nom: "text", prenom: "text" });
// db.etudiants.find({ $text: { $search: "Dupont" } });

// ====================================================================
// 6. REQUÊTES UTILES POUR LA GESTION
// ====================================================================

print("\n=== REQUÊTES UTILES ===\n");

// Étudiants sans inscription
print("--- Étudiants sans inscription ---");
db.etudiants.find({ 
    $or: [
        { inscriptions: { $size: 0 } },
        { inscriptions: { $exists: false } }
    ]
}, { nom: 1, prenom: 1, email: 1 }).limit(5);

// Étudiants avec statut actif
print("\n--- Étudiants avec statut actif ---");
db.etudiants.find({
    "inscriptions.statut": "actif"
}, { nom: 1, prenom: 1 }).limit(5);

// Statistiques globales
print("\n--- STATISTIQUES ---");
print("Total étudiants: " + db.etudiants.countDocuments());
print("Total notes: " + db.notes.countDocuments());

// ====================================================================
// 7. CRÉATION D'INDEX POUR OPTIMISATION
// ====================================================================

print("\n=== CRÉATION D'INDEX ===\n");

// Index sur email (unique)
db.etudiants.createIndex({ nom: 1, email: 1 }, { unique: true });
print("✓ Index unique créé sur email");

// Index sur nom et prénom
db.etudiants.createIndex({ nom: 1, prenom: 1 });
print("✓ Index composite créé sur nom et prénom");

// Index sur ville
db.etudiants.createIndex({ "adresse.ville": 1 });
print("✓ Index créé sur ville");

// Afficher tous les index
print("\n--- Index existants ---");
db.etudiants.getIndexes();

print("\n=== SCRIPT TERMINÉ ===\n");