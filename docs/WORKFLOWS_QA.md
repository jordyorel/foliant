# Automatisation V1 — Validation

## Périmètre

Une règle sans code demande une approbation lorsqu'un nouveau document PDF est
enregistré dans le workspace du propriétaire connecté. Elle partage uniquement
sa première version enregistrée avec un destinataire disposant d'un compte
vérifié. La création et la reprise nécessitent un consentement explicite.

Les uploads Guest et les sauvegardes de nouvelles versions ne déclenchent pas la
règle. Les documents antérieurs ne sont pas traités rétroactivement. Les outils
Guest ne changent pas et aucune restriction premium n'est ajoutée.

## Contrôles locaux — 10 octobre 2026

- Onze tests ciblés passent dans `tests/studio-workflows.test.ts` et
  `tests/studio-workflow-save.test.ts` : compte requis, origine, taille du corps,
  consentement, outils autorisés, destinataire, isolation, pause/reprise, limite
  concurrente de cinq règles, version initiale, filtres, déduplication,
  requêtes Supabase filtrées et sauvegarde préservée en cas de panne.
- Migration appliquée deux fois sur PostgreSQL 18 local, dans une base jetable
  sans données personnelles : limite de cinq règles, RLS propriétaire sur règles
  et exécutions, interdiction de mutation directe authentifiée, RPC réservée au
  serveur et unicité `(workflow_id, document_id)` vérifiées.
- Suite complète : 283 tests réussis, un ignoré. TypeScript et compilation de
  production validés sur une copie isolée.
- Formulaire bureau/mobile 390 × 844 vérifié avec un compte fictif dans une
  copie locale : outils pertinents, champs accessibles, consentement obligatoire,
  pas de débordement horizontal. Aucune règle réelle activée.

## Activation Supabase — effectuée le 10 octobre 2026

Migration exécutée dans Safari sur le projet Foliant
(`vdshellpqyodqaodzzll`) : résultat « Success. No rows returned ».
Sur le compte réel connecté, `/en/studio/workflows` charge les règles et le
journal sans erreur. Le formulaire « New rule » s'ouvre, et son bouton
d'activation reste désactivé sans consentement. Formulaire refermé sans création
de règle ; aucun partage automatique n'a été activé.

## Exécution réelle — validée le 10 octobre 2026

Après autorisation explicite de l'utilisateur pour un test temporaire entre ses
deux comptes, sans utiliser ses documents personnels :

- Propriétaire connecté dans Safari ; destinataire connecté dans Brave.
- Règle `QA automatisation PDF 10 octobre`, ID
  `b358d476-6161-4063-b748-b9b02c24f866`, outil `rotate_pdf`, maximum 0,02 Mo.
- Upload de `tests/fixtures/light.pdf` (PDF fictif « Hello Foliant », 2,8 Ko),
  rotation puis sauvegarde du résultat `light-rotated.pdf` dans le workspace.
- Document `doc_f78f84b0-d0c2-4162-bc62-36b39a5a7df7` : une exécution terminée
  « Approval requested », demande `64649fb5-07f3-48b8-a66b-ddd6a14726e7` sur V1.
- Règle mise en pause aussitôt après ce déclenchement ; pause confirmée à l'écran.
- Rotation supplémentaire puis sauvegarde de V2. Demande toujours sur V1 ; le
  destinataire a pu afficher le PDF et approuver V1. Journal propriétaire
  rechargé : une seule exécution, règle toujours en pause.
- Le destinataire ne voit aucune règle ni exécution du propriétaire. L'URL
  directe de sa règle refuse l'accès sans révéler son contenu (message générique
  « Automation is unavailable »).
- Aucun document personnel modifié ou partagé. Le PDF fictif et la règle en
  pause sont conservés comme témoins du test.

La règle était déjà en pause lors de la sauvegarde V2 : ce test confirme
l'épinglage de l'approbation, mais ne prouve pas à lui seul l'absence de
déclenchement V2 avec une règle active. Ce dernier cas, les filtres négatifs,
la reprise et les erreurs restent validés par les tests locaux.

## Recette complémentaire facultative

1. Migration `docs/supabase_workspace_workflows.sql` déjà appliquée après les
   migrations de documents/versions, activité et approbations. RLS reste activé.
2. Ouvrir `/fr/studio/workflows` avec le compte de test propriétaire.
3. Créer une règle ciblée, après accord explicite pour le partage, vers le second
   compte de test. Utiliser uniquement un nouveau PDF neutre.
4. Enregistrer ce nouveau résultat : vérifier une exécution terminée et une
   demande d'approbation sur V1, visibles après rechargement.
5. Modifier/enregistrer V2 : vérifier qu'aucune nouvelle exécution n'est créée et
   que la demande reste attachée à V1.
6. Mettre la règle en pause, enregistrer un autre PDF neutre et vérifier l'absence
   de demande. Tester ensuite la reprise avec consentement.
7. Vérifier que l'autre compte ne voit pas les règles ni leurs journaux privés.
8. Laisser la règle en pause après la recette.

## Limites explicites

- V1 ne déplace pas de fichier et n'envoie pas d'email automatique. L'action est
  une demande dans le module Approbations existant.
- Maximum cinq règles non archivées, actives ou en pause, après la migration de
  gestion. Archiver libère une place sans supprimer la règle ni les exécutions.
  Jusqu'à cette migration, l'ancien plafond de cinq règles reste en vigueur.
- Le journal affiche les cent dernières exécutions du compte.
- La sauvegarde attend uniquement la mise en file durable. Le traitement démarre
  après la réponse et reprend à la réouverture du journal, ou par le worker de
  maintenance indépendant. Le document reste enregistré si la mise en file échoue ; l'API
  renvoie alors `workflows: unavailable` et un événement technique sans données
  personnelles est journalisé.
- Un arrêt entre l'enregistrement et le déclenchement peut manquer une exécution.
  Les anciens traitements inline incertains ne sont jamais rejoués. Pour les
  nouveaux traitements, approbation et journal sont validés dans une transaction :
  une interruption conserve les deux ou annule les deux.
- Mettre en pause ou archiver empêche le partage d'une entrée encore en attente.
  Modifier une règle invalide les entrées de son ancienne révision, sans retirer
  l'accès aux demandes antérieures. Annuler une demande utilise
  le module Approbations.
- Le stockage local est mono-processus ; les limites distribuées reposent sur
  PostgreSQL et ses RPC. La file des automatisations ne remplace pas le stockage
  mono-processus des jobs PDF.

## Gestion des règles — contrôles locaux du 10 octobre 2026

- Modification des champs avec nouveau consentement et validation du destinataire
  vérifié ; état actif/en pause explicite. La date de modification empêche de
  traiter rétroactivement des documents enregistrés avant les nouveaux critères.
- Archivage logique avec confirmation : arrêt des futures exécutions, conservation
  des anciennes demandes et du journal, aucune reprise/modification d'une archive.
- Liste des archives sur demande (jusqu'à cent règles), détail propriétaire
  accessible même pour une archive plus ancienne ; historique inchangé.
- Seize tests ciblés passent : API, isolation, archivage, limite, consentement,
  compatibilité avec le schéma Supabase antérieur et panne non masquée.
- Suite complète : 288 tests réussis, un ignoré. TypeScript et compilation de
  production (159 pages) validés sur copie isolée, après retrait des simulations.
- `tests/workflow-management.sql` vérifié sur la base PostgreSQL locale jetable :
  migration appliquée deux fois, emplacement libéré, plafond conservé, historique
  conservé, réactivation interdite, droits et RLS inchangés.
- Formulaire prérempli, sauvegarde d'une règle en pause, confirmation d'archivage
  et filtre archives testés dans le navigateur sur une copie isolée. Compte
  fictif et résolution de destinataire simulés dans cette copie uniquement.
  Vue mobile 390 × 844 contrôlée ; taille affichée lisiblement sans modifier
  le seuil en octets lorsque le champ n'est pas changé.
- Migration Supabase réelle **appliquée le 10 octobre** via le SQL Editor du
  navigateur intégré, après l'échec de saisie fiable dans Brave. Script sélectionné
  et comparé intégralement au fichier local avant Run ; résultat
  `Success. No rows returned`. Vérification SQL : les deux colonnes existent,
  RLS reste actif, RPC de création et UPDATE direct non accessibles au rôle
  `authenticated`. Capture : `/private/tmp/foliant-workflow-management-migration-success.png`.
- Test sur le compte propriétaire connecté dans Safari : modification de la
  règle QA `b358d476-6161-4063-b748-b9b02c24f866`, renommée
  `QA automatisation PDF 10 octobre - gestion`, seuil changé de 0.02 à 0.03 Mo,
  règle maintenue en pause. Destinataire inchangé, consentement confirmé.
  Sauvegarde puis relecture serveur affichent les valeurs modifiées.
- Archivage depuis Safari avec confirmation : règle retirée de la liste active,
  journal toujours visible. Contrôle SQL ciblé : `enabled=false`,
  `archived=true`, `edited=true`, une exécution conservée. Aucun document personnel
  modifié, aucune nouvelle approbation envoyée. La règle témoin précédemment
  laissée en pause est désormais archivée. Capture :
  `/private/tmp/foliant-workflow-management-real-verified.png`.
- Filtre archives et isolation après archivage restent couverts par les tests
  locaux ; ils n'ont pas été revalidés entre deux sessions réelles dans ce lot.
  Le navigateur Safari a été repris par le propriétaire pendant cette partie.

## File Durable — 10/11 Octobre 2026

- Migration `docs/supabase_workspace_workflow_queue.sql` appliquée sur Supabase :
  script de 5117 caractères comparé intégralement avant Run, succès confirmé.
  Vérification : file présente, RPC enqueue/worker non accessibles au rôle
  authenticated, RLS actif. Preuve : `/private/tmp/foliant-workflow-queue-verified.png`.
- Mise en attente liée au propriétaire et à V1, doublons exclus par règle/document.
  Les traitements legacy sont explicitement exclus de la reprise automatique.
- Worker Supabase transactionnel avec `FOR UPDATE SKIP LOCKED` : approbation,
  activité et résultat du traitement valident ou annulent ensemble.
- Worker local mono-processus : verrou par propriétaire et identifiant stable
  d'approbation, permettant la reprise même si l'approbateur a déjà répondu.
- Endpoint maintenance authentifié ; au maximum dix entrées par appel.
  Commande indépendante disponible : `npm run worker:workflows`.
  Aucun secret ni processus permanent de worker créé automatiquement.
- 301 tests réussis, un ignoré ; TypeScript vérifié. Contrôles de concurrence,
  pannes fournisseur, reprise après création, pause/édition/archivage et isolation.
- PostgreSQL isolé : migration réappliquée, panne du journal injectée,
  rollback de l'approbation et de l'activité, reprise unique, V1 épinglée, révocation
  et droits privés validés (`tests/workflow-queue.sql`).
- Deux sessions PostgreSQL simultanées : le second worker ignore l'entrée déjà
  verrouillée, puis une seule approbation est créée après libération. Script
  `tests/workflow-queue-concurrency.mjs`, testé le 11 octobre dans `.tmp/qa`.
  La première base temporaire ayant perdu des fichiers, la recette a été refaite
  dans une nouvelle base isolée ; les deux serveurs locaux ont été arrêtés.
- Pas de nouveau partage de document personnel ni nouvelle approbation réelle.
  Recette deux comptes après interruption et activation/supervision sur hébergement
  restent à faire. La fenêtre entre sauvegarde du document et enqueue reste un
  risque distinct : les documents sans entrée ne sont pas balayés rétroactivement.

## Redémarrage Local Réel — 11 Octobre 2026

- Script reproductible : `tests/workflow-queue-restart.mjs`, uniquement après la
  fixture SQL dans le cluster jetable `.tmp/qa/workflow-queue-pg`, socket local
  et port 55440. Il vérifie le répertoire du cluster et les identités fictives
  avant tout arrêt brutal. Ne pas exécuter sur Supabase ou une base de production.
- PDF neutre copié depuis `tests/fixtures/light.pdf` :
  `.tmp/qa/restart-24b17316-8f30-42cb-a926-dd233fdf9060/neutral.pdf`.
  Pages lisibles par pdf-lib, taille réelle enregistrée, empreinte SHA-256
  identique après la recette. Aucun fichier personnel utilisé.
- Exécution du vrai `scripts/workflow-worker.mjs --once` dans des processus Node
  distincts. Interface HTTP loopback de test appelant la vraie RPC PostgreSQL ;
  ce n'est pas le serveur Next.js ni la passerelle REST de Supabase.
- Trois scénarios validés : entrée persistée puis arrêt brutal/reprise ; arrêt
  au milieu de la transaction après l'insertion non validée de l'approbation ;
  coupure HTTP après commit, puis nouvel appel.
- Deux vrais redémarrages PostgreSQL, cinq appels du worker : trois approbations
  et trois événements au total, sans doublon, version V1 conservée. Le compte
  approbateur fictif ne lit pas le journal privé du propriétaire sous RLS.
- Règle QA archivée et serveur PostgreSQL arrêté en fin de recette. Le serveur
  Studio habituel n'a pas été arrêté, et aucune donnée Supabase n'a été modifiée.
- Correction de supervision : le worker `--once` sort désormais avec le code 1
  sur erreur HTTP ou réseau (au lieu de signaler un faux succès). Les tests
  vérifient 200/401/503, refus des redirections et absence de secrets dans les logs.
- Suite complète : 305 tests réussis, un ignoré ; TypeScript et `git diff --check`
  validés. Les tests HTTP nécessitent l'autorisation d'ouvrir un port loopback.
- La validation complète avec deux comptes réels, la passerelle Supabase et un
  redémarrage de l'application reste distincte et non terminée.

## Clôture Automatisations V1 — 11 Octobre 2026

- Migration `docs/supabase_workspace_atomic_save.sql` appliquée sur Supabase :
  succès SQL confirmé, RPC installée, accès anon/authenticated refusé et
  service_role autorisé. Document, première version et enqueue dans la même
  transaction. Aucun balayage rétroactif des documents existants.
- `tests/workflow-atomic-save.sql` : migration réappliquée, panne d'enqueue
  provoquée puis rollback document/V1, reprise et nouvelle tentative sans
  doublon. Fixture PostgreSQL locale isolée, changements de QA annulés.
- Tests de l'adaptateur : upload puis RPC unique, erreur 503 et réponse vide
  rejetées. Le hook ne ré-enqueue pas une sauvegarde déjà mise en file.
- Recette réelle dans Safari (propriétaire Gmail) et Brave (approbateur Proton),
  avec consentement explicite : seul `tests/fixtures/light.pdf` importé.
  Document `doc_69dbd200-a617-461a-a676-56354e33ba6b`, V1 de 2.82 KB.
  Règle `c66c0cb6-3f34-4a69-85fa-83f41571ac5d`, seuil 0.01 Mo.
  Approbation `efcc6ef2-09a3-4d2d-b417-dcb1675119e5` créée automatiquement,
  visible et approuvée sur le second compte ; journal propriétaire terminé.
  Requête Supabase finale : une version, une exécution durable réussie, une
  approbation approuvée, règle désactivée et archivée.
- Règle QA archivée après le test ; filtre archives réel vérifié, historique
  conservé. Le second compte ne voit aucune règle ni exécution du propriétaire,
  même en affichant les archives. Le PDF neutre reste comme témoin privé.
  Aucun document personnel modifié, aucune suppression définitive.
- Suite complète : 309 tests réussis, un ignoré ; TypeScript et contrôle des
  espaces validés. Les tests HTTP nécessitent un port loopback autorisé.
- Limites distinctes : adaptateur local de développement non transactionnel ;
  upload Storage hors transaction SQL, objet potentiellement orphelin sur panne
  avant commit (ne pas supprimer aveuglément après timeout). Worker permanent,
  supervision et redémarrage complet sur hébergement restent des gates de lancement.

Automatisations V1 clôturée. Suite produit : cadrer Inbox V1, sans élargir les
règles d'automatisation ni ajouter de restrictions Guest/premium.
