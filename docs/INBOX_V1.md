# Inbox V1

Statut : socle serveur implemente et migration appliquee sur Supabase
(12 octobre 2026). Interface et recette reelle Lot A restent a faire.
Ce document detaille le lot Inbox de la roadmap principale, sans remplacer celle-ci.

## Role

Inbox est la file des PDF recus qui n'ont pas encore ete ajoutes a Documents.
Documents contient les fichiers conserves et leur historique de versions.
Approbations porte une decision sur une version precise. Automatisations applique
les regles consenties lors du premier enregistrement dans Documents.

Un fichier recu n'est ni approuve ni partage automatiquement. Son expediteur
declare n'est pas une identite authentifiee et ne recoit aucun acces au workspace.
Inbox requiert un compte pour conserver les receptions ; les outils Guest
restent disponibles sans compte, sans nouvelle restriction premium.

## Parcours

1. Le proprietaire depose un PDF dans Inbox ; ensuite, un connecteur email pourra
   alimenter exactement la meme file.
2. Le serveur valide le fichier et le conserve dans un stockage prive.
3. La liste affiche nom complet accessible, taille, date, origine et etat.
4. Le proprietaire ouvre l'apercu, telecharge l'original ou archive la reception.
5. Ajouter a Documents conserve les octets d'origine comme V1, sans conversion,
   compression ou reorganisation implicite, puis ouvre le document sauvegarde.
6. Les regles actives et consenties peuvent se declencher a ce premier
   enregistrement, une seule fois. La reception seule ne declenche aucune regle.

Le bouton Importer existant conserve son parcours d'outils. Le depot Inbox sera
une action distincte, pour ne pas transformer tout import Guest en reception.

## Lot A - Reception Et Tri

- Page `/[locale]/studio/inbox`, navigation Studio et compteur de receptions
  a traiter reels ; conserver Bientot disponible tant que le module n'est pas actif.
- Depot manuel de PDF, sans simulation de reception email ni documents fictifs.
- Liste compacte, recherche par nom, filtres a traiter/ajoutes/archives et tri
  par date ; etats de chargement, vide et erreur distincts.
- Detail avec apercu et telechargement prives, metadonnees d'origine et actions
  Ajouter a Documents / Archiver. PDF protege : indication et telechargement,
  pas de fausse erreur fichier introuvable, pas de mot de passe conserve.
- Archivage recuperable ; pas de suppression definitive ou purge automatique
  introduite dans ce premier lot.
- Quatre langues, clavier, focus visible et mise en page bureau/mobile.

Etats metier : `received`, `accepted`, `archived`. La validation en cours et les
erreurs d'import sont des etats techniques, pas des receptions deja exploitables.
L'archivage d'une reception acceptee ne supprime pas son document ni ses versions.
Restaurer une archive retrouve son etat anterieur, sans recreer de document.

## Donnees Et Fiabilite

- Une reception appartient a un seul `user_id` : identifiant, nom, MIME detecte,
  taille, cle privee, empreinte SHA-256, origine, dates, etat et document accepte.
- Toutes les listes, details, fichiers et mutations verifient le proprietaire ;
  RLS sur Supabase, aucune cle privilegiee dans le navigateur.
- Le contenu PDF reel est valide, pas seulement l'extension ou le MIME fourni.
  Limite de taille alignee sur la politique PDF existante, quota de receptions et
  limitation de debit avant exposition externe ; noms non utilises comme chemins.
- La repetition d'une meme requete de depot est idempotente. Deux depots
  intentionnels du meme fichier peuvent rester distincts ; ne pas dedupliquer
  mondialement par empreinte et ne pas reveler les fichiers d'autres comptes.
- Accepter deux fois ou simultanement une reception retourne le meme document.
  Document, V1, lien reception/document et enqueue doivent etre transactionnels.
  La source reste disponible apres une panne ; aucune suppression aveugle sur timeout.
- L'activite conserve reception, acceptation et archivage, sans recopier les
  contenus du PDF ni les corps de mails dans les logs techniques.

Le schema accepte maintenant `source_job_id` nul pour un import direct,
`kind_tool=import_pdf`, `source_inbox_id` et une protection PDF explicite.
Les contrats document/version suivent cette origine ; aucun job PDF fictif
ni etiquetage de reception comme reorganisation ne sont necessaires.
Une regle Tous les outils peut couvrir l'import accepte ; une regle Pivoter PDF
ne doit pas etre declenchee par un simple depot. Aucun replay des anciens fichiers.

## Lot B - Reception Email Reelle

- Adresse de reception opaque par compte, attribuee par le serveur, non derivee
  du simple email de connexion ; activation explicite et desactivation possible.
- Adaptateur de fournisseur email entrant, verification du webhook selon son
  protocole, limites sur corps/nombre/taille des pieces jointes et protection replay.
- Routage par destinataire attribue, jamais par un `user_id` fourni dans le mail.
  Identifiant fournisseur/message/piece jointe unique pour les retries.
- PDF uniquement au depart ; contenu non pris en charge signale sans execution
  de piece jointe, affichage de HTML brut ou chargement de contenu distant.
- Politique anti-abus et analyse/quarantaine des pieces jointes a valider avant
  ouverture publique ; ne pas afficher fichiers analyses ou securises sans moteur reel.
- Etat de connexion email honnete : non configure tant que domaine, fournisseur,
  webhook accessible et livraison reelle ne sont pas verifies.

Le SMTP sortant du magic link ne fournit pas une boite de reception entrante.
Le fournisseur et le domaine entrant seront choisis lors de ce lot. Sans
configuration externe, seule la validation locale de l'adaptateur sera marquee faite.

## Hors Perimetre

OCR/IA, extraction de factures, boites Gmail/Outlook connectees, liens publics de
depot, cles API utilisateur, equipes, reponses automatiques aux expediteurs,
traitement ou approbation automatique a la reception, facturation et premium.

## Definition De Termine

- Lot A : vrai PDF neutre depose, conserve apres reconnexion, accepte en V1
  intacte et ouvrable dans Studio ; double clic/concurrence sans doublon.
- Deux comptes : aucune reception, metadonnee ou URL fichier accessible a l'autre.
- Panne Storage/DB, PDF invalide, taille excessive, PDF protege, archive/restauration,
  regles non declenchees a la reception et execution unique apres acceptation testes.
- Lot B : livraison email reelle avec retries, refus de webhook invalide et absence
  de routage inter-compte verifies. Les tests simules ne cloturent pas ce lot.
- Roadmap : Lot A fini n'est pas reception email finie ; ne pas annoncer Inbox
  email complete avant la recette externe.

## Ordre D'Implementation

1. Schema Supabase, modele d'origine, politiques d'acces et tests transactionnels.
2. API de depot/liste/detail/fichier/acceptation/archive avec tests d'isolation.
3. Interface Inbox, compteur reel, quatre langues et QA bureau/mobile.
4. Recette Lot A avec deux comptes et un PDF neutre, puis connecteur du Lot B.

## Validation Du Socle - 12 Octobre 2026

- Migration `supabase_workspace_inbox.sql` appliquee sur le projet Supabase ;
  tables RLS, contrats document/version et RPC privees verifies dans SQL Editor.
- API compte requis : depot binaire borne, liste paginee, detail, original prive,
  acceptation et archive/restauration. Mutation meme origine et debit limite.
- Maximum 25 Mio par PDF, 200 receptions et 250 Mio par compte, archives et
  reservations incluses. Ces limites sont de securite, pas des limites premium.
- Depot idempotent par requete et empreinte ; acceptation transactionnelle
  document/V1/lien/activite/enqueue. Original et copie Documents ont des cles
  distinctes ; supprimer Documents ne supprime pas l'original Inbox.
- PDF chiffre reconnu avec qpdf si pdf-lib ne peut pas lire ses objets ; nombre
  de pages inconnu conserve nul. Aucun mot de passe stocke ou decryptage implicite.
- 330 tests automatises reussis, un test conditionnel ignore ; TypeScript valide.
  Les tests API utilisent des reponses Supabase simulees, pas les comptes reels.
- PostgreSQL local : migration repetee, panne d'enqueue et rollback, quotas,
  RLS entre deux utilisateurs fictifs, archive/restauration et PDF protege.
  Deux connexions acceptant simultanement produisent un document, une V1,
  un evenement d'acceptation. Aucun document personnel utilise.
- Restent : interface quatre langues/bureau/mobile, compteur reel et recette
  navigateur/Supabase entre deux vrais comptes. Lot A non cloture ; Lot B non commence.
