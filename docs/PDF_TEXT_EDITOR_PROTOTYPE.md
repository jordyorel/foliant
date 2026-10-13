# Premier prototype : remplacement natif du texte

Statut : preuve locale réalisée sur PDF synthétiques. Pas de bouton dans Studio,
pas d'API publique, pas de document personnel ni d'opération Supabase.
Le plan complet reste dans `PDF_TEXT_EDITOR_V1.md`.

## Ce qui fonctionne

- Analyse des streams PDF avec operands structurés et offsets précis ; aucun
  remplacement global de chaînes ou regex dans les octets compressés.
- Détection des polices standard Type1 WinAnsi : Helvetica, Times, Courier et
  leurs variantes, taille, couleur DeviceRGB/Gray/CMYK et ligne de base.
- Réécriture du seul operand `Tj` visé avec la même ressource de police, sans
  rectangle de masquage et sans création d'une annotation supplémentaire.
- Plusieurs éditions dans un stream : application par offsets décroissants.
  Identifiants liés à l'empreinte source ; source périmée et ids forgés refusés.
- Préservation des autres opérateurs, de l'image et des traits voisins, du fond
  coloré, de l'autre occurrence du même texte, de la page suivante, de la rotation
  de page et du CropBox. Réécriture de l'objet original dans une sauvegarde complète.
- Refus explicite des caractères non encodables et du texte plus large que
  l'original. Aucune réduction de taille automatique.

Les polices sont **standard non embarquées**. Le nom de ressource et les métriques
standard sont identifiés ; leur dessin peut varier selon le lecteur et les
polices disponibles sur la machine. Aucune police embarquée personnalisée n'est
encore détectée/réutilisée par ce moteur.

## Exécuter la démonstration sur Mac

Depuis la branche `inbox-ui-cloud`, après `git pull --ff-only` et `npm ci`,
avec Node 24 :

```bash
node scripts/pdf-text-prototype.mjs
```

Le script crée un nouveau dossier `.tmp/pdf-text-prototype/demo-*` sans écraser
les démonstrations précédentes. Il affiche son chemin. Ouvrir `before.pdf` et
`after.pdf` dans ce dossier : la ligne violette devient
« Texte corrigé : œ, ñ, ã », avec le même fond et les mêmes éléments voisins.
Le `manifest.json` contient les propriétés des segments du PDF synthétique.
Ces fichiers sont ignorés par Git et créés avec des permissions privées.

Un avertissement Node sur le type de module peut apparaître pendant l'import
du fichier TypeScript ; il n'impose pas de modifier le type de tout le projet.

## Validation exécutée

18 tests ciblés : variantes de police, remplacement, suppression, source périmée,
id forgé, éditions multiples, accents, caractères refusés, largeur, exclusions,
rotation et CropBox. Réouverture avec PDF.js et vérification de la ligne de base,
du corps et de la largeur. Extraction indépendante avec `pdftotext` : nouveau
texte présent, ancien texte ciblé absent, voisins conservés.

Rendus avec `pdftoppm` et comparaison pixel par pixel : les différences restent
dans la zone éditée ; aucun changement hors de cette zone sur la fixture.
`qpdf --check` ne relève aucune erreur de syntaxe/stream dans la sortie.
Ces assertions ciblées restent différentes d'une garantie de fidélité sur tous
les PDF ou d'une fonction de caviardage sécurisé.

TypeScript et build de production passent. La suite globale exécutée compte
354 tests réussis, 4 échecs et 1 ignoré. Les quatre échecs sont des timeouts de
30 secondes sur les conversions Excel/LibreOffice existantes (deux processeurs,
un parcours API et un pipeline). Ils se reproduisent sur les tests isolés ; une
cache locale writable et la désactivation du calcul multithread ne les corrigent
pas. Cause encore non déterminée ; aucune assertion désactivée ni timeout de test
augmenté pour annoncer un succès. Les fichiers de conversion Office sont inchangés
et ne font pas appel au prototype. Ne pas annoncer la suite globale verte.

```bash
npm test -- tests/existing-text-prototype.test.ts
npm run typecheck
```

Le test de rendu/extraction indépendante est conditionnel à la présence des
binaires Poppler ; `qpdf` est utilisé lorsqu'il est disponible. Une absence de
ces outils doit être signalée comme non validation indépendante sur la machine.

## Limites et prochain gate

Analyse limitée à 25 Mio d'entrée, 100 pages, 2 Mio de contenu décodé par stream,
100 000 tokens par stream et 2 000 segments ; 20 éditions maximum par export.
Les limites de décompression sont vérifiées après décodage : ce prototype
**n'est pas suffisamment durci pour recevoir des PDF non fiables via une API**.
Tout document partiellement pris en charge expose les pages refusées avec leur
raison ; les pages refusées ne deviennent pas éditables.

Refus des polices custom/sous-ensembles, `TJ` avec kerning, obliques/transformations
complexes, clipping/transparence, streams partagés, Form XObjects, texte vertical,
AcroForm, documents structurés et scans sans texte. Les rotations de page
orthogonales sont conservées ; cela ne valide pas encore le hit testing au clic.
Les unités de page personnalisées sont refusées. Pas de substitution de police,
édition multiligne, reflow, UI clavier/mobile ni intégration aux versions.

La première approche native réutilise `pdf-lib` déjà installé ; aucune nouvelle
dépendance de moteur ou licence AGPL/commerciale n'a été adoptée. Les API de bas
niveau utilisées demandent des tests de compatibilité lors des mises à jour.
La comparaison avec un autre moteur reste ouverte pour les polices embarquées.

Prochaine tranche : corpus de polices embarquées complètes et partielles,
mapping Unicode et caractères supplémentaires. Selon le résultat, élargir le
moteur natif ou choisir un moteur spécialisé avec licence adaptée. Ensuite
seulement brancher la sélection au clic dans PDF.js. Le gate moteur complet
et la recette réelle de l'éditeur restent ouverts.
