# Approbations V1 : validation du 9 octobre 2026

## Perimetre

Studio 0.8, sans deploiement. Les essais reels utilisent uniquement le PDF
neutre `light-reordered.pdf` (Hello Foliant), jamais les documents personnels.

## Controles reussis

- Suite complete : 27 fichiers, 272 tests reussis, un test conditionnel ignore.
- Build Next.js de production : compilation, TypeScript et generation de
  159 pages reussis dans une copie isolee sans fichiers d'environnement.
- Migration Supabase appliquee le 6 octobre ; droits et RLS controles.
- Migration et scenarios SQL sur PostgreSQL local : isolation, concurrence,
  transitions atomiques et reappliquabilite.
- Brave avec deux comptes distincts : sauvegarde, demande sur la version 1,
  reception et apercu du PDF en lecture seule.
- Approbation avec commentaire, retour proprietaire et persistance apres
  rechargement complet.
- Refus avec commentaire et annulation avec confirmation.
- Annulation : retrait de l'apercu et des commandes de decision du destinataire.
- Route d'edition du proprietaire inaccessible au destinataire.
- Tests API : identites forgees, tiers non autorise, mutations hors origine,
  taille et validation des entrees, doublons et decisions concurrentes.
- Tests API : version demandee inchangee apres ajout d'une nouvelle version
  puis restauration ; historique conserve apres suppression du document.
- Ecran Guest a 360 et 390 px : pas de debordement horizontal.
- Detail prive sans connexion : invitation a se connecter, aucun PDF ni
  commande de decision exposes ; aucune erreur console observee.
- Brave connecte en emulation 390 x 844 : liste peuplee, formulaire
  proprietaire, apercu en lecture seule, commentaire et confirmation lisibles.
- Decision dans le viewport mobile : approbation de la version 2 avec le
  commentaire `Validation QA mobile du PDF neutre.` ; statut Approved et
  disparition des commandes de decision confirmes.
- Modification reelle du PDF neutre : rotation sauvegardee en version 2,
  historique courant confirme apres rechargement ; la demande historique de
  version 1 conserve son apercu non pivote chez le destinataire.

## Limites

Les deux controles visuels precedemment bloques sont termines. Le mobile est
une emulation Brave avec les sessions reelles existantes, pas un essai sur
telephone physique. La saisie initiale de la demande et du commentaire a ete
faite avec l'emulation desactivee ; affichage des champs, ouverture de la
confirmation et validation finale controles dans le viewport mobile.

Le controle tactile sur appareil physique reste une verification complementaire
avant diffusion publique. Aucun document personnel n'a ete modifie ou partage.
Les outils de developpement et le viewport temporaire ont ete refermes.

Preuves locales :
- `/private/tmp/foliant-approval-current-v2.png`
- `/private/tmp/foliant-approval-pinned-mobile.png`
- `/private/tmp/foliant-approval-list-mobile.png`
- `/private/tmp/foliant-approval-request-mobile.png`
- `/private/tmp/foliant-approval-confirm-mobile.png`
- `/private/tmp/foliant-approval-approved-mobile.png`

## Regles confirmees

Une demande annulee ne donne plus acces a son apercu. Les autres demandes
approuvees ou refusees sur le meme document gardent leur lecture historique
dediee : annuler une demande distincte ne les revoque pas.

Notifications email, Inbox, automatisation et deploiement restent hors de ce
lot. Le prochain lot de la roadmap principale est Studio 0.9, Workflow Builder :
une premiere regle simple avec journal d'execution, sans promettre des actions
ou notifications qui ne sont pas encore implementees.
