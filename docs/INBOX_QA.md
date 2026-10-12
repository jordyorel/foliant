# Recette Inbox sur Mac

Cette recette reste **à effectuer**. Les tests automatisés et la QA Chromium
avec réponses simulées ne remplacent pas ces contrôles avec Supabase.
Ne réappliquer aucune migration. Utiliser uniquement des PDF neutres et des
comptes de test ; ne pas modifier les documents ou règles personnels.

## Lancer la version cloud sur le Mac

Dans le checkout Foliant, vérifier d'abord `git status --short`. Si des
modifications sont présentes, les conserver avant de changer de branche.

Première récupération :

```bash
git fetch origin
git switch --track origin/inbox-ui-cloud
npm ci
npm run dev
```

Si la branche existe déjà localement :

```bash
git switch inbox-ui-cloud
git pull --ff-only
npm ci
npm run dev
```

Garder le `.env.local` du Mac hors de Git. Il doit configurer le projet Foliant
avec `WORKSPACE_STORAGE_DRIVER=supabase`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` et
`SUPABASE_WORKSPACE_BUCKET=workspace-documents`.
Ne jamais copier les clés dans un compte rendu, une capture ou le chat.
Le réglage proxy du cloud n'est pas nécessaire sur un Mac sans ce proxy.

Ouvrir http://localhost:3000/fr/studio/inbox. Si Next.js choisit un autre port,
utiliser celui indiqué dans le terminal. Se connecter avec le compte de test A.
Utiliser un autre profil de navigateur pour le compte de test B : deux onglets
du même profil partagent la session et ne prouvent pas l'isolation.

## Dépôt, consultation et conservation

1. Déposer un PDF neutre, par exemple `tests/fixtures/light.pdf`, avec
   « Choisir un PDF » puis « Recevoir ». Vérifier nom, taille, date, origine
   manuelle et présence dans « À traiter ». Le compteur doit augmenter.
2. Chercher le fichier par son nom, changer le tri et ouvrir le détail au clavier.
   Vérifier aperçu, téléchargement de l'original et historique de réception.
3. Comparer les SHA-256 de l'original et du téléchargement avec
   `shasum -a 256 <fichier>` : ils doivent être identiques.
4. Archiver puis restaurer la réception. Elle doit passer dans « Archivés »
   puis revenir dans « À traiter », avec mise à jour du compteur et du journal.
5. Cliquer « Ajouter à Documents ». Vérifier l'ouverture du document, sa V1,
   le déplacement de la réception vers « Ajoutés » et le compteur.
   L'original Inbox reste téléchargeable.
6. Se déconnecter puis se reconnecter. Vérifier la conservation de la réception,
   du document et de V1. Une seconde acceptation de cette même réception ne doit
   pas créer un second document ni rejouer les automatisations.

## Isolation entre comptes

1. Dans le profil B, vérifier que la réception et le document de A sont absents.
2. Copier uniquement les chemins locaux des routes de détail, fichier et
   document de A et les ouvrir dans le profil B. L'accès doit être refusé,
   sans nom, aperçu ou contenu du PDF de A.
3. Déposer un autre PDF neutre avec B et vérifier réciproquement son absence
   chez A. Déconnexion : les listes privées doivent disparaître immédiatement.

## Autres contrôles

- PDF protégé : indication explicite et téléchargement de l'original, sans
  aperçu automatique ni demande de conserver un mot de passe.
- Fichier invalide ou supérieur à 25 Mio : rejet explicite, aucune réception
  exploitable créée. Ne pas remplir les quotas du projet partagé pour ce test.
- Coupure réseau : message d'erreur et retry ; le retry du même dépôt doit
  conserver sa clé et ne créer qu'une réception.
- Pagination : si un compte de test dispose de plus de 50 réceptions neutres,
  vérifier les pages et leurs bornes. Sinon noter « non effectué » ; ne pas
  multiplier les dépôts dans le projet partagé uniquement pour remplir une page.
- Automatisations : aucune exécution à la réception. Vérifier une exécution
  unique après acceptation avec une règle explicitement créée pour le compte
  de test ; ne pas activer ou modifier les règles personnelles existantes.
- Langues : répéter les contrôles d'affichage dans `/en`, `/es` et `/pt`.
  Tester le clavier, le focus et une fenêtre étroite, puis Safari et Brave.

## Compte rendu

Pour chaque contrôle, noter « réussi », « échec » ou « non effectué », navigateur,
langue et comportement observé. Ne joindre que des données de test neutres.
Les pannes Storage/DB et la concurrence doivent rester distinctes des contrôles
manuels ordinaires : les tests locaux existants ne prouvent pas leur résultat
dans le projet Supabase réel.

Le lot A reste ouvert tant que la recette réelle n'est pas terminée.
Réception email (lot B) et déploiement restent différés.
