# Mini-roadmap : refonte Foliant

Créée le 4 octobre 2026. Statut : identité publique et Studio appliquée ;
fiabilisation des parcours et validation approfondie en cours.

Document séparé de `ROADMAP.md`. Il organise la refonte, sans remplacer les
priorités produit, les limites techniques ou les conditions de lancement du projet.

## Objectif Et Périmètre

Refondre en profondeur le design et les parcours, pas seulement les couleurs :
accueil, pages outils SEO, hub Documents, éditeur Studio, navigation, import,
aperçus, traitement, sauvegarde, versions et téléchargement.

- Identité rétro-moderne : typographie fine, surfaces claires, plusieurs accents
  maîtrisés, interfaces lisibles et cohérentes.
- Une vue distincte pour chaque rôle : accueil pour choisir, page SEO pour une
  action précise, hub pour retrouver les documents, éditeur pour travailler.
- Guest : outils utilisables sans compte, documents temporaires. Compte :
  sauvegarde durable et versions. Ne pas ajouter de restrictions commerciales.
- Conserver les moteurs et fonctionnalités valides ; remplacer les composants
  ou contrats qui causent réellement des défauts, sans réécriture systématique.
- Ne pas ajouter de fonctionnalités inventées par les maquettes. Inbox,
  Approbations, Automatisation et outils non disponibles restent signalés à venir.
- Pas de déploiement requis pour les étapes locales. La mesure SEO réelle et la
  validation des performances en production restent des étapes après publication.

## Ordre De Travail

1. Mesurer l'existant et valider le système visuel.
2. Refondre l'accueil et toutes les pages outils SEO disponibles, dans les quatre langues.
3. Refondre le hub et l'éditeur Studio, puis fiabiliser sauvegarde/téléchargement.
4. Fiabiliser les parcours de chargement et de téléchargement, avec contrôles de régression.

Chaque lot doit être utilisable et vérifié avant de généraliser au suivant.
Pas de changement global de CSS sans vérifier les pages concernées.

## Socle Commun : Mesurer Et Fiabiliser

- [ ] Reproduire le ralentissement signalé sur Brave : distinguer serveur,
  réseau, thread principal, rendu PDF, mémoire et composition graphique.
  Les optimisations déjà réalisées ne prouvent pas que le problème est résolu.
- [ ] Enregistrer un état de référence : accueil, page outil, hub et éditeur ;
  bureau/mobile, petit PDF, PDF image lourd et document multipage.
- [ ] Mesurer séparément navigation, transfert du fichier, attente du traitement,
  premier aperçu, interactions et préparation du téléchargement.
- [ ] Fixer les budgets de performance après cette mesure ; comparer avant/après
  sur les mêmes fichiers et appareils. Les tests locaux ne sont pas des mesures
  de terrain sur le site publié.
- [x] Définir les composants communs : typographie, palette, icônes, espacements,
  boutons, menus, champs, états sélectionnés, focus, erreurs et chargements.
- [ ] Prévoir clavier, tactile, contrastes, réduction des animations et tailles
  stables. Éviter flous coûteux et animations qui retardent les interactions.
- [ ] Centraliser les états du parcours : sélection, transfert, attente,
  traitement, résultat prêt, sauvegarde, échec, expiration et abandon.
- [x] Afficher une progression réelle pour les transferts mesurables ; utiliser
  un état indéterminé pour les traitements sans progression connue.
- [ ] Empêcher les doubles soumissions et les réponses obsolètes ; interrompre
  les requêtes devenues inutiles. Ne pas présenter un job comme annulé si le
  serveur continue de le traiter.
- [ ] Préserver les contrôles serveur, l'isolation des comptes et la confidentialité.
  Ne pas journaliser fichiers, mots de passe, contenu ou identifiants de session.

## Volet A : Accueil Et Pages SEO

### A1. Structure Et Identité

- [ ] Valider la maquette de l'accueil seule, puis une page outil complète,
  sur bureau et mobile. Ne pas confondre maquettes et pages fonctionnelles.
- [x] Conserver sur l'accueil : outils essentiels, catégories, parcours,
  confiance, FAQ, catalogue et liens utiles.
- [x] Garder Outils/Parcours/FAQ/Studio au centre du header et langue/connexion/
  commencer à droite sur bureau ; prévoir une navigation mobile dédiée.
- [x] Sur chaque page outil : titre précis, upload accessible immédiatement,
  explications propres à l'outil, étapes, limites, FAQ et outils associés.

### A2. Contenu Et SEO

- [x] Périmètre complet : tous les outils publics disponibles, en français,
  anglais, espagnol et portugais. Aucun lot limité à trois pages pilotes.
- [x] Remplacer les paragraphes et FAQ génériques par du contenu spécifique,
  fidèle aux options réellement disponibles et aux limites du moteur.
- [x] Préparer des titres et descriptions uniques ; garder une hiérarchie de
  titres claire et un contenu textuel accessible hors interactions.
- [x] Relier les outils par besoins réels, au-delà du catalogue global.
- [x] Préserver les URL existantes ; prévoir des redirections si une URL doit
  changer. Vérifier canonical, hreflang et traductions complètes.
- [x] Vérifier sitemap, indexation des pages publiques, ressources nécessaires
  au rendu et exclusion du Studio et des documents privés.
- [ ] Optimiser images, polices et JavaScript ; éviter que le lecteur PDF ou les
  moteurs du Studio soient chargés inutilement sur les pages publiques.
- [x] Vérifier la couverture complète du catalogue et des quatre langues.
- [ ] Après publication : Search Console, inspection des URL, suivi requêtes/
  impressions/clics et choix de guides utiles selon les données observées.

### A3. Parcours Public Et Chargement

- [ ] Uniformiser sélection, glisser-déposer, validation, options et transfert,
  tout en conservant les besoins spécifiques de fusion/conversion/compression.
- [ ] Distinguer transfert et traitement ; conserver le fichier sélectionné
  lorsque c'est possible après une erreur récupérable.
- [ ] Rendre les transitions vers le Studio prévisibles, sans ancienne modale
  email, flash de page intermédiaire ou session connectée affichée Guest.
- [ ] Gérer fichiers invalides/protégés/trop lourds, réseau interrompu, attente
  serveur et expiration avec un message utile et une action adaptée.

## Volet B : Hub Documents Et Studio

### B1. Hub Et Éditeur

- [x] Valider séparément le hub Documents et l'éditeur, avec la même identité
  mais une présentation adaptée à chacun.
- [ ] Hub : liste réelle, recherche/tri/filtres, sélection, import direct,
  états vide/chargement/erreur et statut temporaire ou enregistré clair.
- [ ] Éditeur : navigation toujours accessible, outils compatibles activés,
  outils indisponibles non cliquables et statut Guest/compte constant.
- [x] Refondre miniatures, zoom, panneaux, menus et modales ; conserver des
  dimensions stables et ne pas masquer le document sous les contrôles.
- [ ] Fluidifier rendu progressif des PDF, défilement, zoom, dessin de signature,
  déplacement/redimensionnement et saisie ; maîtriser mémoire et rerendus.
- [ ] Ne pas réinitialiser les modifications lors d'un changement de panneau,
  d'une actualisation des données ou d'une réponse réseau tardive.

### B2. Sauvegarde, Versions Et Téléchargement

- [ ] Définir une source de vérité pour le document actuel : PDF source,
  modifications non enregistrées, résultat traité et version durable.
- [ ] Télécharger doit inclure les modifications actuelles, jamais revenir
  silencieusement au résultat précédent. Vérifier texte, signature et formulaire.
- [ ] Distinguer préparation du PDF, résultat prêt et transfert lancé ; proposer
  une reprise adaptée en cas d'échec, sans perdre le travail ni créer de doublons.
- [ ] Vérifier nom, extension, type MIME, taille et validité du fichier reçu.
  Ne pas prétendre que le fichier est enregistré sur le disque de l'utilisateur
  si le navigateur ne permet pas de le confirmer.
- [ ] Sauvegarde durable : confirmer la version réellement créée avant de
  l'afficher comme enregistrée ; conserver les modifications en cas d'échec.
- [ ] Vérifier historique, restauration, suppression, reconnexion et isolation
  entre deux comptes, sur le stockage réel et pas uniquement des mocks.
- [ ] Préserver le document actif pendant la connexion depuis une session Guest.
- [ ] Maintenir l'accès cohérent aux PDF protégés et aux résultats non PDF.

## Conditions De Validation

- [x] Parcours complet : page outil -> import -> traitement -> Studio ->
  modification -> téléchargement -> ouverture du fichier dans un lecteur externe.
- [ ] Parcours compte : sauvegarde -> fermeture -> reconnexion -> réouverture ->
  restauration d'une version, avec contenu et droits vérifiés.
- [ ] Vérifier erreurs réseau, doubles clics, changement rapide de document,
  actualisation, expiration et tentative d'accès au document d'un autre compte.
- [ ] Comparer performance avant/après, captures bureau/mobile, clavier/tactile
  et navigateurs représentatifs, dont le Brave où le problème a été signalé.
- [x] Tests ciblés, suite de régression, TypeScript et build ; contrôler les
  métadonnées et liens rendus sur toutes les pages SEO.
- [ ] Pour chaque lot, noter preuves, limites et étapes encore non validées.
  Ni une belle maquette ni un test automatisé seul ne clôturent un parcours.

## Prochaine Étape

Finir les contenus spécifiques aux outils et les contrôles du Studio : formulaire,
signature, versions, erreurs et mémoire sur document multipage. Puis comparer les
performances, vérifier deux comptes réels et documenter les gates externes.

## Preuves Du Lot Public, 4 Octobre 2026

- 29 outils publics refondus dans quatre langues : 116 pages outils, plus les
  quatre accueils. Les six outils différés n'ont pas été activés.
- Audit HTTP des 120 pages : réponses 200, un H1 par page, descriptions uniques
  par langue, canonical cohérents et quatre hreflang. Aucun échec relevé.
- Import réel d'un PDF de contrôle : options de compression, traitement,
  arrivée dans le Studio Guest et téléchargement `light-optimized.pdf` vérifiés.
- Affichage 1280 x 720 et 390 x 844 : header, zone d'import, menu mobile et FAQ
  vérifiés. Les captures finales et contrôles de toutes les tailles restent à finir.
- Image de l'accueil : WebP local de 40 Ko ; polices système. Les modales de
  traitement sont chargées à la demande, et non dès l'ouverture de la page.
- Les transferts utilisent les événements XHR ; les traitements n'affichent
  plus de pourcentage issu des étapes internes du job.
- TypeScript et build passent. Suite : 229 tests réussis, un ignoré ; tests
  ciblés ultérieurs : 28 réussis. Refaire la suite après le lot Studio.
- Restent notamment : profilage Brave, contrats d'abandon/réponses obsolètes,
  validation visuelle complète, erreurs récupérables, refonte du Studio et
  parcours multi-compte réel. Aucun de ces points n'est déclaré terminé.

## Preuves Du Lot Studio Et Parcours, 4 Octobre 2026

- Nouvelle identité scoping Studio : hub et éditeur, navigation, commandes,
  zoom, panneaux, formulaires et modales. Captures bureau et mobile contrôlées.
  Le hub conserve les modules futurs « Bientôt disponible », sans faux compteurs.
- Import depuis le hub réellement testé : sélection `light.pdf`, transfert,
  traitement, entrée dans l'éditeur Guest et aperçu PDF.
- Téléchargement après saisie « Refonte Foliant QA » : fichier rouvert avec
  pypdf ; le texte ajouté est présent. Ce test ne valide pas encore la signature
  et le formulaire, qui restent à contrôler visuellement et logiquement.
- Le catalogue Studio est séparé de l'éditeur ; la modale d'import est chargée
  à la demande. Le survol d'une ligne ne remonte plus un aperçu PDF différent.
- Requêtes document abandonnables, sans nouvelles tentatives après un refus
  d'accès. Six tests dédiés passent : document absent, accès refusé, succès,
  échec transitoire, abandon préalable et abandon pendant le délai.
- Les douze modales publiques partagent un suivi de job borné et abandonnable,
  un verrou de soumission et un transfert XHR interrompu à la fermeture.
  Les délais artificiels avant affichage des options sont retirés.
- Compression publique retestée après cette centralisation : transfert, options,
  traitement et entrée dans Studio fonctionnent. Une expiration d'upload a aussi
  été rencontrée ; le message et la reprise de cet état restent à améliorer.
- Traitement indéterminé également dans l'import Studio ; aucun pourcentage
  calculé à partir des étapes serveur. Limite de raster PDF : 8 millions de pixels
  et 4096 pixels par côté ; les canvas hors écran sont libérés après trois secondes.
  Cela ne remplace pas le profilage mémoire réel ni la validation Brave.
- Deux régressions moteur couvertes : suppression de pages finales et conservation
  des champs AcroForm lors de l'ajout de texte sans réorganisation de pages.
  La rotation d'une signature image est maintenant appliquée à l'export.
- Dernière suite complète avant centralisation des modales : 239 tests réussis,
  un ignoré. Puis sept tests ciblés réussis pour polling et budget raster.
  TypeScript et build passent après la centralisation ; refaire la suite finale.
- Restent ouverts : contenu FAQ spécifique, reprise d'erreurs, tests complets
  formulaire/signature, comptes réels, performance comparative, Brave et SEO publié.
  La mini-roadmap n'est pas déclarée terminée prématurément.

## Contrôles Et Corrections, 5 Octobre 2026

- Formulaire fourni `Job_Application_Form_f48c4cae2f.pdf` : réparation ciblée
  des racines AcroForm qui référençaient les widgets du nom au lieu du parent.
  Deux tests couvrent ce défaut et la conservation des formulaires valides.
- Parcours navigateur réel : import depuis Documents, ouverture de Remplir PDF,
  saisie du nom et de l'email, fermeture du panneau, téléchargement. Vérification
  pypdf : nom et email conservés, deux widgets liés au même champ du nom.
- Signature dessinée : placement, clic extérieur qui masque les poignées,
  nouvelle sélection et déplacement testés. Export combiné formulaire/signature
  rouvert avec pypdf et rendu avec Poppler : valeurs et signature visibles,
  aucun cadre de sélection exporté. Cela ne valide pas encore tous les styles,
  rotations, import d'image, interactions tactiles ou sauvegardes de compte.
- Chargements des versions et champs formulaire désormais interrompus lorsqu'ils
  deviennent obsolètes. Terminer reste disponible pour un formulaire modifié
  même après fermeture de son panneau.
- Attente de protection/déverrouillage sans faux pourcentage ; verrou synchrone
  de soumission et requêtes interrompues au démontage de la fenêtre.
- FAQ : questions adaptées à la compression, conversion de texte, résolution
  des images, organisation et sécurité, dans les quatre langues. Les étapes
  détaillées propres à chaque outil restent à enrichir.
- Quatre tests de transfert couvrent progression mesurée, abandon préalable,
  interruption active et délai dépassé. Treize tests ciblés passent.
- Dernière suite complète : 245 réussis, un ignoré, avant les quatre nouveaux
  tests de transfert. TypeScript passe ; build validé avant les dernières
  corrections de libellés et transfert. Refaire les vérifications finales.
- Preuve de rendu local : `/private/tmp/foliant-signed-form.png`.
  Brave, comparaison de performance et parcours de deux comptes réels restent
  ouverts ; aucune validation de production ou Search Console n'est revendiquée.

### Complément Du Lot

- Les étapes de préparation ne répètent plus l'introduction : elles décrivent
  les réglages disponibles pour compression, fusion, division, export d'images,
  organisation, annotations et sécurité. Couverture des 29 outils et quatre langues.
- Nouvel audit HTTP : 120 pages, aucune erreur de métadonnées ou couverture.
- Header : menus fermés au clic extérieur, au choix d'un lien et avec Échap ;
  actualisation du statut de connexion au retour dans l'onglet et via le canal
  d'authentification. Menu mobile portugais testé à 390 x 844, sans débordement.
- La restauration utilise le numéro de version confirmé pour rafraîchir l'aperçu.
  Sauvegarde, préparation du téléchargement et restauration partagent un verrou
  synchrone. Ces changements restent à tester avec deux comptes réels.
- Connexion Guest : actualisation des données serveur plutôt que rechargement
  complet de la fenêtre, afin de préserver le brouillon de l'éditeur. Validation
  réelle du magic link avec document modifié encore requise.
- Suite complète : 249 tests réussis, un ignoré ; build réussi avant les derniers
  changements restauration/connexion, puis TypeScript réussi après ces changements.
- Capture mobile : `/private/tmp/foliant-home-mobile-pt.png`.
  La mini-roadmap reste ouverte pour les validations listées plus haut.

## Clôture Du Lot De Contrôles Locaux, 5 Octobre 2026

L'utilisateur demande de valider les contrôles locaux pour le moment. Les parcours
avec deux comptes réels restent différés, pas remplacés par les tests avec mocks.

- Signature image : export ajusté proportionnellement et centré dans son cadre,
  comme l'aperçu, au lieu d'étirer l'image. Deux régressions couvrent les formats
  portrait et paysage. La rotation continue de s'effectuer autour du centre.
- Signature mobile : les trois modes Dessiner, Taper et Importer mesurent chacun
  765,48 px de hauteur de formulaire à 390 x 844 après correction. L'espace interne
  est stable ; la largeur de fenêtre n'a pas été augmentée.
- Hub et éditeur mobile : largeur de document et largeur défilable de 390 px,
  sans débordement global. Zoom de 100 à 125 % testé, accès aux outils et affichage
  PDF contrôlés. Captures finales bureau/mobile enregistrées.
- Export en cours : requêtes et suivi des jobs interrompus au changement de
  document ou au démontage ; abandon vérifié avant lancement du téléchargement.
  Cela n'annule pas un traitement déjà lancé sur le serveur.
- Isolation automatisée : ajout du endpoint de champs formulaire au contrôle
  des accès refusés pour utilisateur non connecté et utilisateur tiers.
- Vérifications finales après les corrections : 251 tests réussis, un ignoré,
  TypeScript et build réussis. Audit public précédent : 120 pages sans erreur.
- Preuves : `/private/tmp/foliant-studio-mobile-final.png` et
  `/private/tmp/foliant-studio-desktop-final.png`.

Restent explicitement non validés : authentification/sauvegarde/restauration avec
deux comptes réels, magic link avec brouillon actif, reproduction et profilage
natif Brave, mesures comparatives avant/après sur le même appareil, interactions
tactiles réelles et mesures SEO après publication. Ces points ne sont pas cochés.

## Fluidité Du Défilement, 5 Octobre 2026

Priorité demandée : scrolling fluide dans Brave, avant les validations de comptes.

- Suivi de la page active limité aux pages proches du viewport grâce à
  IntersectionObserver ; suppression du parcours de toutes les pages à chaque
  frame et des réabonnements du listener à chaque changement de page active.
- Canvases React mémoïsés. Rasterisation limitée à deux opérations simultanées,
  avec priorité aux pages du document devant les miniatures. Un même canvas
  attend la fin de son rendu annulé avant d'être réutilisé.
- Défilement natif conservé, sans interception de la molette. Navigation entre
  pages animée sauf si la préférence système réduit les animations.
- Cinq tests ajoutés : concurrence, sérialisation par canvas, priorité, abandon
  en attente et libération après erreur. Suite : 256 réussis, un ignoré ;
  TypeScript valide. Vitest signale un délai de fermeture de worker API malgré
  une sortie réussie ; ce diagnostic n'est pas une mesure de fluidité navigateur.
- Contrôle visuel local sur le formulaire déjà utilisé : zoom à 125 %,
  défilement aller-retour, PDF visible, aucune erreur/warning console capturée.
  Capture : `/private/tmp/foliant-scroll-local.png`.
- Test multipage avec un nouveau fixture non effectué : import refusé pour
  respecter la restriction de document de test. Pas de mesure FPS avant/après.
- Brave natif reste non validé : accès Computer Use en attente des autorisations
  macOS d'accessibilité et d'enregistrement d'écran. Aucun réglage de Brave
  modifié et aucune amélioration mesurée dans ce navigateur revendiquée.
