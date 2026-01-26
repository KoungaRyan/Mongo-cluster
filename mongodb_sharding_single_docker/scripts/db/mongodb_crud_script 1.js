// ====================================================================
// SCRIPT CRUD ET INTERROGATION - GESTION PROMOTION (MongoDB Sharded)
// ====================================================================
// Base de données : gestion_promotion
// Collections : etudiants (shardée sur 'nom'), notes
// ====================================================================

// Connexion à la base de données
use gestion_promotion

// ====================================================================
// 1. CREATE - Opérations d'insertion
// ====================================================================

print("\n=== OPÉRATIONS CREATE ===\n");

// Insérer un seul étudiant avec la structure Mockaroo
var result1 = db.etudiants.insertOne({
    id: 1001,
    prenom: "Marie",
    nom: "Dupont",
    email: "marie.dupont@email.com",
    date_naissance: "2000-05-15",
    telephone: "0601020304",
    promotion_id: "PROMO_2025"
});

print("✓ Un étudiant inséré - _id: " + result1.insertedId);

// Insérer plusieurs étudiants
var result2 = db.etudiants.insertMany([
    {
        id: 1002,
        prenom: "Pierre",
        nom: "Martin",
        email: "pierre.martin@email.com",
        date_naissance: "1999-08-20",
        telephone: "0602030405",
        promotion_id: "PROMO_2025"
    },
    {
        id: 1003,
        prenom: "Sophie",
        nom: "Bernard",
        email: "sophie.bernard@email.com",
        date_naissance: "2001-03-10",
        telephone: "0603040506",
        promotion_id: "PROMO_2026"
    }
]);

print("✓ " + result2.insertedIds.length + " étudiants insérés\n");

// ====================================================================
// 2. READ - Opérations de lecture/interrogation
// ====================================================================

print("=== OPÉRATIONS READ ===\n");

// Afficher tous les étudiants (limité à 5)
print("--- Tous les étudiants (5 premiers) ---");
db.etudiants.find().limit(5).forEach(doc => {
    print(`${doc.id} - ${doc.prenom} ${doc.nom} - ${doc.email}`);
});

// Rechercher un étudiant par nom
print("\n--- Recherche par nom (Dupont) ---");
var dupont = db.etudiants.find({ nom: "Dupont" }).toArray();
print("Trouvé: " + dupont.length + " résultat(s)");
dupont.forEach(doc => {
    printjson(doc);
});

// Rechercher par email
print("\n--- Recherche par email ---");
var etudiant = db.etudiants.findOne({ email: "marie.dupont@email.com" });
if (etudiant) {
    printjson(etudiant);
}

// Rechercher par promotion
print("\n--- Étudiants de PROMO_2025 ---");
var count_promo = db.etudiants.countDocuments({ promotion_id: "PROMO_2025" });
print("Total: " + count_promo + " étudiant(s)");

// Rechercher les étudiants avec un nom commençant par une lettre
print("\n--- Étudiants dont le nom commence par 'V' ---");
db.etudiants.find({ nom: /^V/i }).limit(5).forEach(doc => {
    print(`${doc.prenom} ${doc.nom}`);
});

// Projection : afficher uniquement certains champs
print("\n--- Nom, prénom et email uniquement ---");
db.etudiants.find(
    {},
    { id: 1, nom: 1, prenom: 1, email: 1, _id: 0 }
).limit(10).forEach(doc => {
    print(`${doc.id} - ${doc.nom} ${doc.prenom} - ${doc.email}`);
});

// Recherche avec regex (recherche partielle sur email)
print("\n--- Étudiants avec email .edu ---");
db.etudiants.find({ email: /\.edu$/ }).limit(5).forEach(doc => {
    print(`${doc.prenom} ${doc.nom} - ${doc.email}`);
});

// Trier les résultats
print("\n--- Étudiants triés par nom (ordre alphabétique) ---");
db.etudiants.find({}, { nom: 1, prenom: 1, _id: 0 })
    .sort({ nom: 1 })
    .limit(10)
    .forEach(doc => {
        print(`${doc.nom} ${doc.prenom}`);
    });

// Compter le nombre d'étudiants
print("\n--- Nombre total d'étudiants ---");
var totalEtudiants = db.etudiants.countDocuments();
print("Total: " + totalEtudiants);

// Compter avec un filtre
print("\n--- Nombre d'étudiants en PROMO_2025 ---");
var totalPromo = db.etudiants.countDocuments({ promotion_id: "PROMO_2025" });
print("Total: " + totalPromo);

// ====================================================================
// 3. UPDATE - Opérations de mise à jour (Compatible Sharding)
// ====================================================================

print("\n=== OPÉRATIONS UPDATE ===\n");

// Pour une collection shardée sur 'nom', on DOIT inclure 'nom' dans la requête
// OU utiliser _id directement

// Méthode 1 : Trouver d'abord l'_id, puis mettre à jour
print("--- Mise à jour avec findOne puis updateOne sur _id ---");
var marie = db.etudiants.findOne({ email: "marie.dupont@email.com" });
if (marie) {
    db.etudiants.updateOne(
        { _id: marie._id },
        { 
            $set: { 
                telephone: "0607080910"
            } 
        }
    );
    print("✓ Téléphone mis à jour pour Marie Dupont");
}

// Méthode 2 : Inclure le shard key (nom) dans la requête
print("\n--- Mise à jour avec shard key (nom) ---");
db.etudiants.updateOne(
    { 
        nom: "Martin",  // Shard key OBLIGATOIRE
        email: "pierre.martin@email.com" 
    },
    { 
        $set: { 
            telephone: "0699887766"
        } 
    }
);
print("✓ Téléphone mis à jour pour Pierre Martin");

// Mettre à jour plusieurs documents avec le même nom (shard key)
print("\n--- Mise à jour multiple sur un même shard ---");
db.etudiants.updateMany(
    { promotion_id: "PROMO_2025" },
    { 
        $set: { statut: "actif" } 
    }
);
print("✓ Statut ajouté pour tous les étudiants de PROMO_2025");

// Mettre à jour par _id (toujours safe)
print("\n--- Mise à jour par ID ---");
var sophie = db.etudiants.findOne({ nom: "Bernard" });
if (sophie) {
    db.etudiants.updateOne(
        { _id: sophie._id },
        { 
            $set: { 
                promotion_id: "PROMO_2025",
                telephone: "0611223344"
            } 
        }
    );
    print("✓ Sophie Bernard mise à jour");
}

// ====================================================================
// 4. DELETE - Opérations de suppression (Compatible Sharding)
// ====================================================================

print("\n=== OPÉRATIONS DELETE ===\n");

// Supprimer par _id (méthode recommandée pour sharded collections)
print("--- Suppression avec findOne puis deleteOne sur _id ---");
var toDelete = db.etudiants.findOne({ id: 1003 });
if (toDelete) {
    db.etudiants.deleteOne({ _id: toDelete._id });
    print("✓ Étudiant avec id:1003 supprimé");
}

// Supprimer avec shard key
print("\n--- Suppression avec shard key ---");
var deleteResult = db.etudiants.deleteOne({ 
    nom: "Dupont",
    id: 1001
});
print("✓ Documents supprimés: " + deleteResult.deletedCount);

// Supprimer plusieurs documents
print("\n--- Suppression multiple ---");
// var deleteMany = db.etudiants.deleteMany({ 
//     promotion_id: "PROMO_2026"
// });
// print("✓ " + deleteMany.deletedCount + " documents supprimés");

// ====================================================================
// 5. REQUÊTES AVANCÉES ET AGRÉGATIONS
// ====================================================================

print("\n=== REQUÊTES AVANCÉES ===\n");

// Agrégation : Compter les étudiants par promotion
print("--- Nombre d'étudiants par promotion ---");
db.etudiants.aggregate([
    {
        $group: {
            _id: "$promotion_id",
            nombre_etudiants: { $sum: 1 }
        }
    },
    { $sort: { nombre_etudiants: -1 } }
]).forEach(doc => {
    print(`${doc._id}: ${doc.nombre_etudiants} étudiant(s)`);
});

// Agrégation : Liste des noms de famille uniques
print("\n--- Top 10 noms de famille ---");
db.etudiants.aggregate([
    {
        $group: {
            _id: "$nom",
            count: { $sum: 1 }
        }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
]).forEach(doc => {
    print(`${doc._id}: ${doc.count}`);
});

// Agrégation : Étudiants par domaine email
print("\n--- Domaines email les plus utilisés ---");
db.etudiants.aggregate([
    {
        $project: {
            domaine: {
                $arrayElemAt: [
                    { $split: ["$email", "@"] },
                    1
                ]
            }
        }
    },
    {
        $group: {
            _id: "$domaine",
            count: { $sum: 1 }
        }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
]).forEach(doc => {
    print(`${doc._id}: ${doc.count}`);
});

// Jointure avec la collection notes (si elle existe)
print("\n--- Étudiants avec leurs notes (lookup) ---");
db.etudiants.aggregate([
    {
        $lookup: {
            from: "notes",
            localField: "id",
            foreignField: "etudiant_id",
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
]).forEach(doc => {
    print(`${doc.prenom} ${doc.nom}: ${doc.nombre_notes} note(s)`);
});

// ====================================================================
// 6. REQUÊTES UTILES POUR LA GESTION
// ====================================================================

print("\n=== REQUÊTES UTILES ===\n");

// Rechercher par plage de téléphone
print("--- Étudiants avec téléphone commençant par 06 ---");
var count06 = db.etudiants.countDocuments({ telephone: /^06/ });
print("Total: " + count06);

// Liste des promotions
print("\n--- Liste des promotions ---");
db.etudiants.distinct("promotion_id").forEach(promo => {
    print("- " + promo);
});

// Étudiants avec des données manquantes
print("\n--- Étudiants sans téléphone ---");
var sansTel = db.etudiants.countDocuments({ 
    $or: [
        { telephone: null },
        { telephone: { $exists: false } },
        { telephone: "" }
    ]
});
print("Total: " + sansTel);

// Statistiques globales
print("\n--- STATISTIQUES GLOBALES ---");
print("Total étudiants: " + db.etudiants.countDocuments());
print("Total notes: " + db.notes.countDocuments());
print("Total promotions: " + db.etudiants.distinct("promotion_id").length);

// Distribution par première lettre du nom
print("\n--- Distribution alphabétique des noms ---");
db.etudiants.aggregate([
    {
        $project: {
            premiere_lettre: { $substr: ["$nom", 0, 1] }
        }
    },
    {
        $group: {
            _id: "$premiere_lettre",
            count: { $sum: 1 }
        }
    },
    { $sort: { _id: 1 } }
]).forEach(doc => {
    print(`${doc._id}: ${"*".repeat(Math.min(doc.count, 50))}`);
});

// ====================================================================
// 7. GESTION DES INDEX
// ====================================================================

print("\n=== GESTION DES INDEX ===\n");

// Afficher les index existants
print("--- Index existants sur la collection etudiants ---");
db.etudiants.getIndexes().forEach(index => {
    print(`- ${index.name}: ${JSON.stringify(index.key)}`);
});

// Créer des index utiles (éviter les doublons)
print("\n--- Création d'index supplémentaires ---");

try {
    db.etudiants.createIndex({ email: 1 }, { 
        unique: true,
        name: "idx_email_unique"
    });
    print("✓ Index unique créé sur email");
} catch (e) {
    print("⚠ Index email existe déjà");
}

try {
    db.etudiants.createIndex({ promotion_id: 1 }, {
        name: "idx_promotion"
    });
    print("✓ Index créé sur promotion_id");
} catch (e) {
    print("⚠ Index promotion_id existe déjà");
}

try {
    db.etudiants.createIndex({ id: 1 }, {
        unique: true,
        name: "idx_id_unique"
    });
    print("✓ Index unique créé sur id");
} catch (e) {
    print("⚠ Index id existe déjà");
}

// ====================================================================
// 8. EXEMPLES DE RECHERCHES SPÉCIFIQUES
// ====================================================================

print("\n=== EXEMPLES DE RECHERCHES ===\n");

// Recherche combinée
print("--- Recherche combinée (nom + promotion) ---");
db.etudiants.find({ 
    nom: /^M/,
    promotion_id: "PROMO_2025"
}).limit(5).forEach(doc => {
    print(`${doc.prenom} ${doc.nom} - ${doc.promotion_id}`);
});

// Recherche avec plusieurs critères
print("\n--- Étudiants avec gmail.com ou edu ---");
db.etudiants.find({
    $or: [
        { email: /gmail\.com$/ },
        { email: /\.edu$/ }
    ]
}).limit(5).forEach(doc => {
    print(`${doc.prenom} ${doc.nom} - ${doc.email}`);
});

// Recherche avec exclusion
print("\n--- Étudiants PAS en PROMO_2025 ---");
var autresPromos = db.etudiants.countDocuments({ 
    promotion_id: { $ne: "PROMO_2025" }
});
print("Total: " + autresPromos);

print("\n=== SCRIPT TERMINÉ ===");
print("Note: Ce script est compatible avec les collections shardées.");
print("Pour les updates/deletes, utilisez toujours _id ou incluez le shard key (nom).\n");