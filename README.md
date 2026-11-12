# Boulon & le Dôme

Tower defense coopératif de science-fiction, vu de dessus.

Tower defense coopératif à 2 joueurs, jouable dans le navigateur (ordinateur et mobile).

- **Stratège** : pose les tours, choisit leurs voies d'amélioration, lance des compétences, pilote l'IA.
- **Héros-réparateur** : répare, ramasse, récolte, recharge, recycle. Joué par un humain **ou par l'IA**.
- **Une seule ressource** pour construire, améliorer et réparer.
- **Cartes aléatoires** à partir d'une seed, **vagues infinies**, un boss toutes les 10 vagues.
- **6 tourelles** (Canon, Givre, Baliste, Bobine Tesla, Rayon focalisé, Relais tactique) + le Dépôt avancé, chacune avec un arbre d'amélioration à 4 niveaux et des voies exclusives ; le bouton « Voir l'arbre » les détaille.
- **Zones de tir variées** : circulaires ; le Canon à rails pivote à 360° et son trait transperce tous les ennemis alignés ; la zone s'affiche au clic sur une tour et avant la pose.
- **Prime de fin de vague** croissante ; la partie se met en pause dès qu'on quitte l'onglet ou la fenêtre.
- **Dépôt avancé** : bâtiment où le héros décharge ses ressources sans retourner à la base.
- **13 types d'ennemis** variés en vitesse, taille, blindage et attaque (essaim, artilleur qui s'arrête pour tirer, sapeur kamikaze, soigneur, blindé, golem…) et 3 boss.
- **Menu de partie** : rejouer (nouvelle carte ou même carte), quitter vers l'accueil, plein écran (touche F).
- **Code de partie** à 5 caractères : on rejoint avant le lancement, ou en cours de partie pour remplacer l'IA.

## Lancer en local

Il faut Node.js 20 ou plus.

```bash
npm install
npm run build     # compile le client
npm start         # serveur + client sur http://localhost:3000
```

En développement, avec rechargement automatique (deux terminaux) :

```bash
npm run dev:server   # serveur de jeu, port 3000
npm run dev:client   # client Vite, http://localhost:5173
```

Tests et vérification des types :

```bash
npm test
npm run typecheck
```

## Déployer

Un seul service à héberger : le serveur Node sert aussi le client compilé et les WebSockets (`/ws`).

- **Sur Vercel** : `vercel.json` est prêt. Le client est servi en statique et les WebSockets passent par la fonction `api/ws.js`, générée par `npm run build:api` à partir de `server/src/vercel.ts`. Limites propres à Vercel : les parties vivent dans la mémoire d'une instance de fonction ; si Vercel en démarre une autre, le client renvoie automatiquement la dernière sauvegarde reçue et la partie reprend, et chaque connexion est renouvelée au bout de la durée maximale de la fonction (le client se reconnecte tout seul).
- **Avec Docker** (Railway, Fly.io, Render, VPS) : c'est l'option la plus fiable pour des parties longues. : le `Dockerfile` à la racine suffit. Le port vient de la variable `PORT` (3000 par défaut).
- **Sans Docker** : `npm ci && npm run build && npm start`.

À savoir : les parties sont en mémoire, donc **une seule instance** (pas de répartition de charge), et un redémarrage du serveur termine les parties en cours. Derrière un proxy, il faut laisser passer les WebSockets.

## Organisation du code

| Dossier | Rôle |
| --- | --- |
| `shared/` | Simulation déterministe, génération et validation de carte, IA du héros, protocole, **données d'équilibrage** |
| `server/` | Salons, codes de partie, sessions par jeton, boucle à 20 ticks/s, envoi de l'état 10 fois/s |
| `client/` | Phaser 3 pour la carte, HTML pour le lobby, le bandeau et les panneaux |

Le serveur fait autorité : les clients envoient des intentions, la simulation les valide. Humain et IA envoient les mêmes commandes, ce qui les rend interchangeables : remplacer l'IA revient à changer qui commande le héros, son état ne bouge pas.

## Équilibrage

Tout se règle dans `shared/src/config/`, sans toucher au code :

| Fichier | Contenu |
| --- | --- |
| `towers.ts` | Tours, arbres d'amélioration à branches exclusives, synergies |
| `enemies.ts` | Ennemis, boss, formules de montée en puissance des vagues |
| `game.ts` | Économie, réparation et usure, héros et son arbre, compétences, récompenses |
| `map.ts` | Taille de carte, chemins, emplacements, gisements, critères de validité |
| `sim/ai.ts` | Réglages des trois postures de l'IA (`POSTURES`) |

Valeurs de départ, à ajuster en jouant :

- Budget de la vague n : `28 × 1,11^(n-1)`, plafonné à 60 ennemis (le surplus devient des PV).
- PV des ennemis : `×1,07` par vague jusqu'à la vague 40, puis `×1,035`.
- Attaque des ennemis : `×1,03` par vague, plafonnée à ×6. Primes : `×1,04`, plafonnées à ×5.
- Boss toutes les 10 vagues, PV `×1,9` à chaque apparition, puis choix d'une récompense parmi trois.
- Réparer 100 % d'une tour coûte 80 % de ce qui a été investi dedans, et retire 6 % de ses PV max.
- Pendant une vague, la réparation plafonne à 70 % des PV ; entre deux vagues, elle est complète.
- 40 % de la prime va directement au stock, 60 % tombe au sol et doit être ramassée par le héros.

Ces chiffres n'ont pas encore été réglés par des parties réelles. Le jeu tourne de base à 1,2 fois le temps réel (`gameSpeed`). Les vitesses x1,5, x2 et x3 s'ajoutent par-dessus, et ne s'appliquent que si tous les joueurs humains les demandent.
- Remise en route du héros après sa chute : 8 s, puis `30 + 5 × vague` ressources sur le stock commun ; sans les moyens, il attend.

## Limites connues du prototype

- Pas de pause ni de ralenti à l'arrivée d'un nouveau joueur.
- Le « changement de mode » d'une tour se limite au choix de la cible.
- Le chemin des ennemis n'est pas modifiable par les joueurs.
- Illustrations originales en SVG (`client/src/art/`), pas encore de sons ni de musique.
- Plein écran : indisponible sur iPhone (limite de Safari) ; ajouter le jeu à l'écran d'accueil (PWA) donne le même effet.
- Sur téléphone : glisser pour déplacer la carte, pincer pour zoomer ; l'affichage n'est pas encore net sur les écrans haute densité.
