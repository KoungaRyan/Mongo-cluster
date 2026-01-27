// ====================================================================
// SCRIPT CRUD ET INTERROGATION - GESTION PROMOTION (MongoDB Sharded)
// ====================================================================
// Base de données : gestion_promotion
// Collections : etudiants (shardée sur 'nom'), notes
// ====================================================================

// ====================================================================
// 0. CONFIGURATION DU SHARDING (à exécuter sur mongos)
// ====================================================================

print("\n=== CONFIGURATION DU SHARDING ===\n");

// Connexion à la base de données
var db = db.getSiblingDB("gestion_promotion");

// Activation du sharding sur la base de données
try {
    sh.enableSharding("gestion_promotion");
    print("✓ Sharding activé sur la base gestion_promotion");
} catch (e) {
    print("⚠ Sharding déjà activé ou erreur: " + e.message);
}

// Création de l'index shard key sur 'id' (obligatoire avant sharding)
try {
    db.etudiants.createIndex({ id: 1 });
    print("✓ Index créé sur le champ 'id' pour le sharding");
} catch (e) {
    print("⚠ Index déjà existant: " + e.message);
}

// Sharding de la collection etudiants
try {
    sh.shardCollection("gestion_promotion.etudiants", {id: "hashed" });
    print("✓ Collection etudiants shardée avec shard key 'id'");
} catch (e) {
    print("⚠ Collection déjà shardée ou erreur: " + e.message);
}

// Nettoyage (optionnel - décommenter si besoin)
print("\n--- Nettoyage des données de test ---");
db.etudiants.deleteMany({ id: { $gte: 11001 } });
print("✓ Données de test précédentes supprimées\n");

// Vérification du statut du sharding
print("--- Statut du sharding ---");
try {
    var shardStatus = sh.status();
    print("✓ Sharding opérationnel");
} catch (e) {
    print("⚠ Erreur lors de la vérification: " + e.message);
}

// Afficher les informations sur les shards
print("\n--- Shards disponibles ---");
db.adminCommand({ listShards: 1 }).shards.forEach(shard => {
    print(`- ${shard._id}: ${shard.host}`);
});

// ====================================================================
// 1. CREATE - Opérations d'insertion
// ====================================================================

print("\n=== OPÉRATIONS CREATE ===\n");

// Insérer un seul étudiant avec la structure Mockaroo
var result1 = db.etudiants.insertOne({
    id: 11001,
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
        id: 11002,
        prenom: "Pierre",
        nom: "Martin",
        email: "pierre.martin@email.com",
        date_naissance: "1999-08-20",
        telephone: "0602030405",
        promotion_id: "PROMO_2025"
    },
    {
        id: 11003,
        prenom: "Sophie",
        nom: "Bernard",
        email: "sophie.bernard@email.com",
        date_naissance: "2001-03-10",
        telephone: "0603040506",
        promotion_id: "PROMO_2026"
    },
    {
        id: 11004,
        prenom: "Lucas",
        nom: "Petit",
        email: "lucas.petit@email.com",
        date_naissance: "2000-11-25",
        telephone: "0604050607",
        promotion_id: "PROMO_2025"
    },
    {
        id: 11005,
        prenom: "Emma",
        nom: "Dubois",
        email: "emma.dubois@email.com",
        date_naissance: "1998-07-08",
        telephone: "0605060708",
        promotion_id: "PROMO_2024"
    }
]);

print("✓ " + Object.keys(result2.insertedIds).length + " étudiants insérés");

// Vérifier la distribution sur les shards
print("\n--- Distribution des données sur les shards ---");
db.etudiants.getShardDistribution();

// ====================================================================
// 2. READ - Opérations de lecture/interrogation
// ====================================================================

print("\n=== OPÉRATIONS READ ===\n");

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
    print(`Trouvé: ${etudiant.prenom} ${etudiant.nom}`);
    printjson(etudiant);
}

// Rechercher par promotion
print("\n--- 10 Étudiants de PROMO_2025 ---");
var count_promo = db.etudiants.countDocuments({ promotion_id: "PROMO_2025" });
print("Total: " + count_promo + " étudiant(s)");
db.etudiants.find({ promotion_id: "PROMO_2025" }).limit(10).forEach(doc => {
    print(`  - ${doc.prenom} ${doc.nom}`);
});

// Rechercher les étudiants avec un nom commençant par une lettre
print("\n--- Étudiants dont le nom commence par 'D' ---");
db.etudiants.find({ nom: /^D/i }).forEach(doc => {
    print(`  - ${doc.prenom} ${doc.nom}`);
});

// Projection : afficher uniquement certains champs
print("\n--- Nom, prénom et email uniquement ---");
db.etudiants.find(
    {},
    { id: 1, nom: 1, prenom: 1, email: 1, _id: 0 }
).limit(10).forEach(doc => {
    print(`${doc.id} - ${doc.nom} ${doc.prenom} - ${doc.email}`);
});

// Recherche avec regex sur email
print("\n--- Étudiants avec email @email.com ---");
db.etudiants.find({ email: /@email\.com$/ }).forEach(doc => {
    print(`  - ${doc.prenom} ${doc.nom} - ${doc.email}`);
});

// Trier les résultats
print("\n--- Étudiants triés par nom (ordre alphabétique) ---");
db.etudiants.find({}, { nom: 1, prenom: 1, _id: 0 })
    .sort({ nom: 1 })
    .limit(10)
    .forEach(doc => {
        print(`  - ${doc.nom} ${doc.prenom}`);
    });

// Compter le nombre d'étudiants
print("\n--- Statistiques ---");
var totalEtudiants = db.etudiants.countDocuments();
print("Total étudiants: " + totalEtudiants);

var totalPromo2025 = db.etudiants.countDocuments({ promotion_id: "PROMO_2025" });
print("Total PROMO_2025: " + totalPromo2025);

// ====================================================================
// 3. UPDATE - Opérations de mise à jour (Compatible Sharding)
// ====================================================================

print("\n=== OPÉRATIONS UPDATE ===\n");

// ⚠️ IMPORTANT pour collections shardées:
// - Utiliser _id directement (toujours safe)
// - OU inclure le shard key (nom) dans la requête

// Méthode 1 : Trouver d'abord l'_id, puis mettre à jour
print("--- Mise à jour avec findOne puis updateOne sur _id ---");
var marie = db.etudiants.findOne({ email: "marie.dupont@email.com" });
if (marie) {
    var updateResult1 = db.etudiants.updateOne(
        { _id: marie._id },
        { 
            $set: { 
                telephone: "0607080910",
                derniere_modification: new Date()
            } 
        }
    );
    print(`✓ ${updateResult1.modifiedCount} document(s) modifié(s) pour Marie Dupont`);
}

// Méthode 2 : Inclure le shard key (nom) dans la requête
print("\n--- Mise à jour avec shard key (nom) ---");
var updateResult2 = db.etudiants.updateOne(
    { id: 11002, nom: "Martin", prenom: "Pierre" },
    { 
        $set: { 
            telephone: "0699887766",
            derniere_modification: new Date()
        } 
    }
);
print(`✓ ${updateResult2.modifiedCount} document(s) modifié(s) pour Pierre Martin`);

// Mettre à jour plusieurs documents
print("\n--- Mise à jour multiple (updateMany) ---");
var updateResult3 = db.etudiants.updateMany(
    { promotion_id: "PROMO_2025" },
    { 
        $set: { 
            statut: "actif",
            annee_scolaire: "2024-2025"
        } 
    }
);
print(`✓ ${updateResult3.modifiedCount} document(s) modifié(s) pour PROMO_2025`);

// Mettre à jour par _id (toujours safe en sharded)
print("\n--- Mise à jour par _id direct ---");
var sophie = db.etudiants.findOne({ nom: "Bernard" });
if (sophie) {
    var updateResult4 = db.etudiants.updateOne(
        { _id: sophie._id },
        { 
            $set: { 
                promotion_id: "PROMO_2025",
                telephone: "0611223344",
                derniere_modification: new Date()
            } 
        }
    );
    print(`✓ ${updateResult4.modifiedCount} document(s) modifié(s) pour Sophie Bernard`);
}

// Incrémenter une valeur
print("\n--- Incrémentation d'un compteur ---");
var lucas = db.etudiants.findOne({ nom: "Petit" });
if (lucas) {
    db.etudiants.updateOne(
        { _id: lucas._id },
        { 
            $inc: { nombre_absences: 1 },
            $set: { derniere_modification: new Date() }
        }
    );
    print("✓ Nombre d'absences incrémenté pour Lucas Petit");
}

// ====================================================================
// 4. DELETE - Opérations de suppression (Compatible Sharding)
// ====================================================================

print("\n=== OPÉRATIONS DELETE ===\n");

// Supprimer par _id (méthode recommandée pour sharded collections)
print("--- Suppression avec _id ---");
var toDelete = db.etudiants.findOne({ id: 1005 });
if (toDelete) {
    var deleteResult1 = db.etudiants.deleteOne({ _id: toDelete._id });
    print(`✓ ${deleteResult1.deletedCount} document(s) supprimé(s) (Emma Dubois)`);
}

// Supprimer avec shard key
print("\n--- Suppression avec shard key (nom) ---");
var deleteResult2 = db.etudiants.deleteOne({ 
    nom: "Petit",
    id: 11004
});
print(`✓ ${deleteResult2.deletedCount} document(s) supprimé(s) (Lucas Petit)`);

// Supprimer plusieurs documents
print("\n--- Suppression multiple (ATTENTION en production!) ---");
// Décommenter pour tester
// var deleteResult3 = db.etudiants.deleteMany({ 
//     promotion_id: "PROMO_2026"
// });
// print(`✓ ${deleteResult3.deletedCount} document(s) supprimé(s)`);
print("⚠ deleteMany commenté pour éviter suppressions accidentelles");

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
            nombre_etudiants: { $sum: 1 },
            etudiants: { $push: { nom: "$nom", prenom: "$prenom" } }
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
            count: { $sum: 1 },
            prenoms: { $push: "$prenom" }
        }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
]).forEach(doc => {
    print(`${doc._id}: ${doc.count} - [${doc.prenoms.join(", ")}]`);
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
    print(`@${doc._id}: ${doc.count} étudiant(s)`);
});

// Jointure avec la collection notes (si elle existe)
print("\n--- Étudiants avec leurs notes (lookup) ---");
var notesCount = db.notes.countDocuments();
if (notesCount > 0) {
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
                nombre_notes: { $size: "$notes_obtenues" },
                moyenne: { $avg: "$notes_obtenues.note" }
            }
        },
        { $limit: 5 }
    ]).forEach(doc => {
        print(`${doc.prenom} ${doc.nom}: ${doc.nombre_notes} note(s) - Moyenne: ${doc.moyenne || "N/A"}`);
    });
} else {
    print("⚠ Collection notes vide");
}

// ====================================================================
// 6. REQUÊTES UTILES POUR LA GESTION
// ====================================================================

print("\n=== REQUÊTES UTILES ===\n");

// Rechercher par plage de téléphone
print("--- Étudiants avec téléphone commençant par 06 ---");
var count06 = db.etudiants.countDocuments({ telephone: /^06/ });
print(`Total: ${count06}`);

// Liste des promotions distinctes
print("\n--- Liste des promotions ---");
var promotions = db.etudiants.distinct("promotion_id");
promotions.forEach(promo => {
    var count = db.etudiants.countDocuments({ promotion_id: promo });
    print(`- ${promo}: ${count} étudiant(s)`);
});

// Étudiants avec des données manquantes
print("\n--- Étudiants avec données incomplètes ---");
var sansTel = db.etudiants.countDocuments({ 
    $or: [
        { telephone: null },
        { telephone: { $exists: false } },
        { telephone: "" }
    ]
});
print(`Sans téléphone: ${sansTel}`);

var sansEmail = db.etudiants.countDocuments({ 
    $or: [
        { email: null },
        { email: { $exists: false } },
        { email: "" }
    ]
});
print(`Sans email: ${sansEmail}`);

// Distribution par première lettre du nom
print("\n--- Distribution alphabétique des noms ---");
db.etudiants.aggregate([
    {
        $project: {
            premiere_lettre: { $toUpper: { $substr: ["$nom", 0, 1] } }
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
    var bar = "*".repeat(Math.min(doc.count, 50));
    print(`${doc._id}: ${bar} (${doc.count})`);
});

// ====================================================================
// 7. GESTION DES INDEX ET PERFORMANCES
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

try {
    db.etudiants.createIndex({ nom: 1, prenom: 1 }, {
        name: "idx_nom_prenom"
    });
    print("✓ Index composite créé sur nom+prenom");
} catch (e) {
    print("⚠ Index nom+prenom existe déjà");
}

// Statistiques de la collection
print("\n--- Statistiques de la collection ---");
var stats = db.etudiants.stats();
print(`Documents: ${stats.count}`);
print(`Taille moyenne: ${Math.round(stats.avgObjSize)} bytes`);
print(`Taille totale: ${Math.round(stats.size / 1024)} KB`);
print(`Index: ${stats.nindexes}`);

// ====================================================================
// 8. VÉRIFICATIONS FINALES
// ====================================================================

print("\n=== VÉRIFICATIONS FINALES ===\n");

print("--- Statistiques globales ---");
print(`Total étudiants: ${db.etudiants.countDocuments()}`);
print(`Total notes: ${db.notes.countDocuments()}`);
print(`Total promotions: ${db.etudiants.distinct("promotion_id").length}`);

print("\n--- Distribution sur les shards ---");
try {
    db.etudiants.getShardDistribution();
} catch (e) {
    print("⚠ Impossible d'afficher la distribution: " + e.message);
}

print("\n=== SCRIPT TERMINÉ ===");
print("✓ Configuration sharding OK");
print("✓ Opérations CRUD testées");
print("✓ Agrégations et requêtes avancées exécutées");
print("\nNote: Pour les updates/deletes sur collections shardées:");
print("  - Utilisez toujours id (recommandé)");