# ČHMÚ Czech weather

La météo officielle de la **Tchéquie** dans Gladys, par le **ČHMÚ** (Český hydrometeorologický
ústav, l'institut hydrométéorologique tchèque) : les mesures de la **station météo** la plus proche
et les **alertes météo officielles** de votre **district ORP** (vent, neige et verglas, orages,
canicule, grand froid, risque d'incendie, pluie, inondation…).

Données ouvertes : ni compte, ni clé d'API. Cette intégration n'a aucun lien avec le ČHMÚ.

## Présentation

- **Deux appareils** : la station la plus proche (température, humidité, pression, vent, rafales,
  pluie, ensoleillement) et les alertes de votre district (niveau en cours, niveau le plus haut
  annoncé, liste des alertes).
- **Un déclencheur de scène**, « Nouvelle alerte du ČHMÚ », dès l'annonce d'une alerte, souvent
  des heures avant son début.
- **Un widget de tableau de bord** avec les mesures de la station et les alertes du district.
- **Lecture seule** : le ČHMÚ est une source de données, rien n'est piloté.

Le ČHMÚ émet ses alertes pour chacun des **206 districts ORP** de Tchéquie (obce s rozšířenou
působností). L'intégration MeteoAlarm affiche aussi les alertes tchèques, par le flux européen ;
celle-ci lit directement les fichiers du ČHMÚ et ajoute les mesures des stations tchèques.

## Prérequis

- Gladys **5.3.0** ou plus récent.
- Un lieu en **Tchéquie**.
- Votre maison Gladys placée sur la carte (**Paramètres → Maisons**), ou des coordonnées, une
  station ou un district saisis dans la configuration.
- Gladys doit accéder à Internet (`opendata.chmi.cz`).

## Configuration

Installez l'intégration depuis **Intégrations → Installer depuis GitHub** (ou depuis le store),
puis ouvrez sa configuration. Tous les champs sont facultatifs : par défaut, l'intégration prend
la position de votre première maison placée, la station la plus proche, le district où elle se
trouve, et rafraîchit toutes les 15 minutes.

| Champ                              | Usage                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Maison                             | La maison dont la position est utilisée. Vide : la première maison qui a une position.                                             |
| Latitude, Longitude                | Un autre lieu qu'une maison, par exemple `50,08` et `14,42` (le point marche aussi). Les deux, ou aucune.                          |
| Station météo                      | Une station du ČHMÚ, par exemple `0-20000-0-11518` ou `P1PRUZ01` (Praha, Ruzyně). Vide : la plus proche.                           |
| District des alertes               | Le nom (`Beroun`, avec ou sans accents) ou le code à 4 chiffres (`2102`) d'un district ORP. Vide : celui du lieu.                  |
| Fréquence de rafraîchissement      | 15, 30 ou 60 minutes. Le ČHMÚ publie les mesures des stations une fois par heure.                                                  |
| Langue des noms de fonctionnalités | Langue des noms de fonctionnalités (fixés à la création des appareils) et des textes des événements de scène. Français par défaut. |

La position de la maison est lue grâce à la permission `location` de Gladys, affichée à
l'installation. Elle ne quitte jamais Gladys : le district est trouvé dans le conteneur, d'après
les contours des districts qu'il embarque, et seuls les fichiers de la station et des alertes sont
téléchargés.

Ouvrez ensuite l'onglet **Découverte** de l'intégration et ajoutez les deux appareils à Gladys.

## Appareils

### Station

Le nom est « ČHMÚ » suivi du nom de la station. Valeurs de la dernière observation sur 10 minutes :

| Fonctionnalité                    | Unité | Remarque                                                    |
| --------------------------------- | ----- | ----------------------------------------------------------- |
| Température                       | °C    | Température de l'air, à 2 m                                 |
| Humidité                          | %     |                                                             |
| Pression (à la station)           | hPa   | À l'altitude de la station, non ramenée au niveau de la mer |
| Vitesse du vent                   | km/h  | Moyenne sur 10 minutes                                      |
| Rafales                           | km/h  | Plus forte rafale des 10 dernières minutes                  |
| Direction du vent                 | °     | D'où vient le vent : 0 = nord, 90 = est                     |
| Intensité de pluie                | mm/h  | Pluie des 10 dernières minutes, ramenée à l'heure           |
| Ensoleillement (10 dernières min) | min   | 0 à 10                                                      |

L'appareil n'a que les fonctionnalités que la station mesure (beaucoup n'ont pas de baromètre). Le
ČHMÚ publie les valeurs sur 10 minutes **une fois par heure** : les mesures ont jusqu'à 70 minutes
environ. Une station muette depuis plus de 3 heures n'est plus republiée comme actuelle.

### District

Le nom est « ČHMÚ » suivi du nom du district.

| Fonctionnalité                   | Unité | Remarque                                                                  |
| -------------------------------- | ----- | ------------------------------------------------------------------------- |
| Vigilance en cours               | 0 à 3 | Niveau le plus haut en cours : 0 aucun, 1 jaune, 2 orange, 3 rouge        |
| Vigilance la plus haute annoncée | 0 à 3 | Niveau le plus haut des alertes en cours ou annoncées                     |
| Alertes météo                    | texte | Les alertes en cours ou annoncées, par ex. « Orange · Vent → mar. 18:00 » |

## Widget

**Météo ČHMÚ** affiche, dans la langue et les unités du tableau de bord :

- le nom de la maison (ou du district), puis la température, l'humidité, le vent et les rafales de
  la station ;
- les alertes en cours (jusqu'à quand) et annoncées (à partir de quand), ou une ligne verte
  « Aucune » ;
- la source et l'heure de l'observation.

Deux réglages du widget masquent les mesures de la station ou les alertes.

## Déclencheur de scène

**Nouvelle alerte du ČHMÚ** se déclenche quand le ČHMÚ émet une alerte pour le district, ou en
relève le niveau, dès l'annonce. Le ČHMÚ réémet ses alertes plusieurs fois par jour : une alerte
seulement prolongée ou réémise ne redéclenche pas. Un redémarrage non plus, et le tout premier
démarrage ne fait que prendre note des alertes déjà émises.

Filtres (vide = tous) : **Types d'alerte** (vent, neige et verglas, orages, brouillard, canicule,
grand froid, risque d'incendie, pluie, inondation, autre phénomène) et **Niveaux** (jaune, orange,
rouge).

Informations transmises aux actions de la scène : type d'alerte, niveau, niveau (1 à 3), nom
officiel (en anglais et en tchèque), début, fin, déjà en cours, niveau relevé, texte officiel et
conseils (en anglais) et district. Par exemple, un message : `ČHMÚ : alerte
{{triggerEvent.data.type_label}} {{triggerEvent.data.level_label}} de
{{triggerEvent.data.starts_at}} à {{triggerEvent.data.ends_at}}`.

## Actions de configuration

- **Lister les stations proches** : les 8 stations les plus proches du lieu, avec leurs
  identifiants, leur altitude et leur distance, et le district d'alerte du lieu. Copiez un
  identifiant dans « Station météo » pour en choisir une autre.
- **Tester la connexion** : lit toutes les sources tout de suite et dit ce qui a répondu : la
  température de la station et son heure, le nombre d'alertes. Affiché en rouge si une source
  échoue.

## Exemples de scènes

- **Tempête annoncée** : déclencheur « Nouvelle alerte du ČHMÚ », types « Vent » et « Orages »,
  niveaux « Orange » et « Rouge » → fermer les volets, rentrer le store, envoyer un message avec
  l'heure de début.
- **Journée de canicule** : quand « Vigilance en cours » devient supérieure ou égale à 2 → fermer
  les volets côté sud et envoyer un rappel pour boire.
- **Gel** : quand la « Température » de la station passe sous 0 °C → prévenir pour protéger les
  plantes.

## Dépannage

- **« Aucun lieu »** : aucune maison n'a de position. Placez votre maison sur la carte dans
  **Paramètres → Maisons**, ou saisissez des coordonnées, une station ou un district.
- **« Hors de Tchéquie »** : le lieu n'est dans aucun district tchèque. Saisissez un district à
  suivre malgré tout.
- **« Le ČHMÚ ne répond pas »** : Gladys n'atteint pas `opendata.chmi.cz` ; les valeurs sont mises à
  jour à son retour. Les journaux disent quelle source échoue, une fois, et quand elle repart.
- **Une fonctionnalité manque** : la station ne la mesure pas. Choisissez une autre station avec
  **Lister les stations proches**.
- **Plus de détails** : mettez la variable `LOG_LEVEL` du conteneur à `debug`.

## Limites

- **Données** : données ouvertes du ČHMÚ, licence
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (« Source : ČHMÚ », affiché par le
  widget). Contours des districts : ČÚZK (RÚIAN) et ČSÚ, CC BY 4.0, simplifiés à 500 m environ :
  près d'une limite de district, saisissez le district.
- **Requêtes** : à chaque rafraîchissement, l'index des CAP (100 Ko environ) et le fichier de la
  station, qui ne revient que quand le ČHMÚ le réécrit (une fois par heure, 150 Ko environ) ; le
  fichier CAP (1,5 à 2 Mo) seulement quand un nouveau est émis, quelques fois par jour ; la liste des
  stations une fois par jour. Le ČHMÚ ne publie pas de limite.
- Les observations arrivent par lots horaires de valeurs sur 10 minutes, pas en direct.
- Un lieu, une station et un district par installation. Pas de prévisions : le ČHMÚ n'en publie pas
  en données ouvertes pour un point.
- Les noms des fonctionnalités sont fixés à la création des appareils : changer la langue ensuite ne
  les renomme pas.
