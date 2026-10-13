# Édition du texte existant — V1

Statut : plan technique et critères de validation. Fonctionnalité non implémentée.
Référence produit : expérience décrite de Sejda (clic sur le texte et récupération
de son style), sans supposer connaître son moteur ni garantir la même couverture.
La recette réelle Inbox reste ouverte ; réception email et déploiement différés.

## Expérience attendue

1. Activer « Modifier le texte existant », distinct de « Ajouter du texte ».
2. Survoler une ligne modifiable : contour discret, sans altérer la page.
3. Cliquer ou sélectionner au clavier : texte prérempli et panneau de style.
4. Afficher police, taille en points, couleur, graisse/inclinaison et espacement
   lorsqu'ils sont identifiés. Distinguer propriétés exactes, approximatives et
   inconnues ; ne pas présenter une police de remplacement comme l'originale.
5. Modifier le contenu ; conserver par défaut la ligne de base, le style et la
   position. Aperçu immédiat, annuler/rétablir, avertissement de dépassement.
6. Enregistrer un PDF édité et vérifié ; pour un document sauvegardé, créer une
   nouvelle version sans écraser V1. Pour Guest, conserver le parcours temporaire.

Objectif : remplacement réel du texte de la zone sélectionnée. Un rectangle
blanc avec du texte superposé ne satisfait pas cette fonctionnalité.
L'édition n'est pas une fonction de caviardage sécurisé : les versions antérieures
conservent les originaux et aucune purge globale des métadonnées n'est promise.

## Périmètre progressif

### V1 initiale

- PDF numériques avec texte Unicode identifiable et correspondance source fiable.
- Sélection d'une ligne ou d'un segment homogène ; écriture horizontale gauche
  à droite, transformations simples. Rotation de page à 0/90/180/270 degrés.
- Texte français, anglais, espagnol et portugais, accents et ponctuation inclus.
- Police disponible et réutilisable, ou police de substitution explicitement
  choisie après vérification des caractères et de la largeur.
- Pas de déplacement des paragraphes voisins, pas de réorganisation automatique
  de toute la page. Le dépassement est bloqué tant qu'il n'est pas résolu.

### Cas à détecter et expliquer

Scans sans couche texte (OCR ultérieur), texte transformé en contours, mapping
Unicode ambigu, police Type 3, texte vertical/RTL, effets de peinture complexes,
transparence/clipping, géométrie oblique non prise en charge et blocs de styles
mélangés restent non modifiables dans la V1 initiale. Un Form XObject partagé
reste exclu tant que sa copie indépendante et son adressage ne sont pas validés.
Une rotation de page ne doit pas être confondue avec un texte oblique.

Les champs AcroForm continuent d'utiliser « Remplir un PDF ». Les PDF chiffrés
passent par le parcours de déverrouillage existant sans conservation du mot de
passe. Ne pas éditer silencieusement un PDF signé numériquement : détecter la
signature et expliquer sa perte de validité avant toute éventuelle copie éditée.
Ne pas accepter une page seulement parce que l'extraction texte a réussi.

## État du code et architecture

- `StudioPdfViewer.tsx` : rendu PDF.js 6.3, worker et budgets de rendu existants.
  Ajouter l'analyse et la couche de sélection des pages visibles, sans lancer
  une analyse complète de gros fichiers à chaque zoom.
- `StudioDocumentWorkspace.tsx` : historique `EditorPlan`, opérations de pages,
  état non sauvegardé et versions. Ajouter une liste séparée `textEdits`.
- `processors/pdf/reorder.ts` : dessine les annotations avec les familles
  Helvetica/Times/Courier. Ce pipeline ne remplace actuellement aucun texte
  source et ne peut pas être présenté comme un moteur d'édition native.
- `processors/pdf/text.ts` : extraction heuristique utile à d'autres outils,
  insuffisante pour adresser précisément et modifier des opérateurs PDF.

### A. Analyse du document

Dans le navigateur, utiliser les API publiques PDF.js `getTextContent()` pour
le texte et les transformations, et l'analyse des opérateurs de peinture pour
les styles absents des items texte. La couleur et la graisse ne se déduisent
pas de façon fiable d'un simple `fontName`. Recouper avec les ressources de
police analysées côté serveur ; éviter une dépendance aux objets privés PDF.js.

Le serveur construit un manifeste validé lié à l'empreinte du PDF source : page
source, stream/ressource et séquence d'opérateurs, offsets, texte Unicode, glyphes,
matrice, ligne de base, boîte, style et capacités. Un item PDF.js peut contenir
plusieurs fragments source ; un fragment peut correspondre à plusieurs items.
L'agrégation en lignes doit préserver cette correspondance et refuser l'ambiguïté.

Le hit testing utilise les mêmes matrices PDF → viewport que le rendu, avec
CropBox, origine non nulle, rotation, zoom et densité de pixels. Les coordonnées
canoniques restent en points PDF ; aucun positionnement sauvegardé en pixels CSS.
Indexer seulement les pages nécessaires, annuler les requêtes obsolètes, borner
la taille des manifests et libérer les ressources au changement de document.

### B. Contrat de style et de police

Un `FontDescriptor` contient la référence de ressource, le nom PDF brut, le nom
de famille normalisé quand connu, les métriques, le type, le statut embarqué/
sous-ensemble, le mapping Unicode et les droits de réutilisation lorsqu'évaluables.
Un préfixe de sous-ensemble ne prouve ni le nom commercial ni la disponibilité
de tous les caractères. Ne pas transmettre le binaire de police privilégié
sans décider comment son utilisation dans le navigateur sera autorisée.

Chaque propriété possède un statut `exact`, `estimated` ou `unknown`.
La capacité d'édition est séparée de la confiance de détection :

| État | Comportement |
| --- | --- |
| Police réutilisable et caractères disponibles | Conserver la police et ses métriques |
| Glyphes manquants ou police non réutilisable | Proposer une substitution explicite avec aperçu et contrôle de largeur |
| Mapping ou source ambigu | Refuser l'édition du segment avec une raison localisée |

Ne jamais réduire automatiquement le corps ou condenser le texte pour le faire
tenir. Un style gras/italique détecté doit utiliser une vraie variante disponible
ou être annoncé comme indisponible. Ne pas télécharger arbitrairement des polices
externes ; prévoir un catalogue local de polices dont l'intégration est autorisée.

### C. Historique et modèle d'édition

`ExistingTextEdit` : identifiant opaque du segment, empreinte du manifeste/source,
page source stable, nouveau texte, style demandé, résolution de police choisie.
Le texte original et les coordonnées calculées viennent du manifeste serveur,
pas de valeurs arbitraires envoyées par le navigateur.

Conserver ces éditions séparées des annotations ajoutées. Une saisie possède un
brouillon local ; valider une étape d'historique à la fin de l'édition plutôt
qu'une sauvegarde réseau par frappe. Escape annule le brouillon, Undo/Redo agit
sur l'historique ; le bouton de validation permet les retours ligne ultérieurs.
Pour V1, refuser les retours ligne et conserver le segment sur sa ligne source.

Les opérations de pages adressent les pages source, même après réorganisation.
Une page supprimée et ses éditions sont retirées ensemble et restaurées par
Undo. Toute nouvelle source/version invalide le manifeste et ses identifiants.
Séparer les régions de sélection du contenu du PDF pour ne pas bloquer les liens,
champs de formulaire ou outils existants. Aucun faux état « sauvegardé » local.

### D. Export serveur et choix du moteur

PDF.js sert à analyser/afficher ; il ne fournit pas l'export d'un PDF édité.
`pdf-lib` conserve son rôle existant. Avant de choisir une dépendance supplémentaire,
réaliser un prototype comparatif sur les fixtures ci-dessous :

1. Réécriture ciblée des streams avec parseur structuré d'opérateurs et gestion
   des ressources/polices. Pas de remplacement par regex des chaînes PDF.
2. Moteur spécialisé pouvant retirer le contenu textuel ciblé et réinsérer le
   nouveau texte en préservant les objets voisins. Évaluer séparément couverture,
   isolation du contenu, performances, déploiement et licence.

MuPDF/PyMuPDF ou une bibliothèque commerciale peuvent être candidats ; leur
licence et leur API réelle doivent être vérifiées avant toute adoption.
Une opération de redaction rectangulaire qui efface aussi images ou graphismes
adjacents ne remplit pas les exigences. Le choix du moteur est un résultat du
prototype, pas une capacité supposée de la stack actuelle.

Gate obligatoire : remplacement réel, caractères supplémentaires, fidélité
hors zone et réouverture du résultat démontrés. Si aucun candidat ne passe,
réduire explicitement les formats pris en charge avant de développer l'interface.

Le serveur revalide propriétaire/session Guest, source, version et manifeste,
bornes, nombre d'éditions, longueur de texte et capacités de police. Il calcule
une sortie temporaire complète avant de l'intégrer aux jobs et aux versions.
Une source périmée renvoie un conflit et ne rejoue pas les éditions ailleurs.
Pipeline : éditer les pages source, appliquer les opérations de pages et les
annotations selon un ordre fixé, puis vérifier l'export. Conserver les éléments
non modifiés ; documenter toute incompatibilité avec les documents structurés.

Réécrire le fichier de sortie sans mise à jour incrémentale conservant le vieux
stream édité dans cette sortie. L'original reste conservé dans les versions
antérieures. Ne pas promettre la suppression d'autres occurrences, de contenus
masqués ou de métadonnées à partir de cette opération de modification.

## Lots d'implémentation et décisions attendues

1. **Prototype et corpus** : manifeste, extraction du style, remplacement d'une
   ligne, tests des polices/sous-ensembles, rapport comparatif et choix du moteur.
2. **Sélection et détection** : couche de hit testing, panneau de style, états
   exact/estimé/non pris en charge, focus et sélection au clavier.
3. **Édition et historique** : saisie, police, largeur, aperçu, Undo/Redo et
   interaction avec réorganisation/rotation/suppression de pages.
4. **Export et versions** : validation serveur, job isolé, sauvegarde Vn+1,
   Guest, gestion des conflits et vérification du résultat.
5. **Recette** : corpus complet, quatre langues, Safari/Brave/Chromium,
   bureau/mobile, deux comptes et absence de régression des outils actuels.

Livrer une première tranche : cliquer une ligne simple, modifier son contenu
avec la même police disponible, exporter et réouvrir. Aucune estimation de
parité Sejda ni de délai fiable avant le résultat du prototype moteur.

## Critères de validation bloquants

| Domaine | Résultat exigé |
| --- | --- |
| Clic et clavier | Sélectionner le bon segment, éditer sans ajouter une annotation, focus visible, Escape et Undo/Redo cohérents |
| Style | Taille/couleur/position identiques sur fixtures exactes ; police ambiguë annoncée, jamais inventée |
| Police | Tester police complète, sous-ensemble avec caractères présents et absents, police manquante ; substitution seulement consentie |
| Géométrie | Clic et export corrects à zoom 50/100/200 %, densité 1/2, rotation 0/90/180/270 et CropBox décalée |
| Export natif | Le nouveau texte est sélectionnable/recherchable ; les anciens glyphes du segment ciblé ne restent ni peints ni extraits à cet emplacement |
| Fidélité | Hors zone d'édition, aucun changement des textes, images, traits et liens ; contrôle visuel et structurel |
| Mise en page | Texte trop long : dépassement annoncé et export bloqué jusqu'à résolution, aucun débordement ou changement de taille silencieux |
| Historique | Annuler/rétablir contenu et style ; changer l'ordre/rotation des pages ne déplace pas l'édition sur une autre page |
| Versions | Vn+1 valide après reconnexion, Vn inchangée ; une panne ne crée pas de version annoncée comme réussie |
| Accès | Un autre compte/session ne peut analyser, exporter ou télécharger le document ; manifeste périmé refusé |
| Cas exclus | Scan, contours, mapping ambigu, Type 3 et effets complexes produisent une explication, aucun export corrompu |
| Régression | Ajout de texte, signature visuelle, AcroForm, opérations de pages et parcours Guest existants continuent de passer |
| Confidentialité | Aucun texte de document, binaire de police, mot de passe ou clé dans les logs et captures de QA |

Les noms de police normalisés, Unicode extrait et glyphes cibles doivent être
contrôlés par plusieurs méthodes : PDF.js, un extracteur indépendant et inspection
des opérateurs du stream modifié. Chercher une chaîne brute dans le fichier n'est
pas une preuve suffisante avec encodages, compression et occurrences multiples.
Valider également la structure avec `qpdf --check` et ouvrir dans plusieurs lecteurs.

### Corpus minimal

Fixtures synthétiques et neutres : Helvetica/Times/Courier ; police Unicode
complète ; sous-ensemble ; accents `é à ç œ ñ ã` ; ligatures ; espaces/kerning
dans `TJ` ; style mixte ; fond blanc/coloré et image derrière le texte ; images
et traits proches ; textes tournés ; CropBox ; Form XObject partagé ; PDF scanné,
texte en contours, chiffré et signé ; formulaire AcroForm et document multipage.
Des fichiers non pris en charge doivent valider le refus, pas être omis des tests.

### Performance et validation humaine

Mesurer séparément chargement, analyse, interaction, export et mémoire sur une
machine et un navigateur nommés. Objectifs initiaux à confirmer par le prototype :
interaction après indexation sous 100 ms, analyse d'une page simple sous 1 s,
export d'un document de 10 pages avec 20 éditions sous 5 s dans l'environnement
de référence. Les gros documents restent soumis aux budgets existants et à des
limites d'analyse explicites ; aucun test avec zéro segment éditable ne valide V1.

Recette manuelle : vrai PDF neutre numérique, clic/modification/export/réouverture,
quatre langues de l'interface, clavier, bureau/mobile et versions avec deux
comptes. Noter réussite/échec/non effectué et les substitutions utilisées.
Les tests simulés et prototypes ne clôturent pas la recette réelle.
