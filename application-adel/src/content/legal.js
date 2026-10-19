/** Textes légaux affichés tels quels (échappés par Twig). */

export const KEYWORDS = [
  'Coach Adel',
  'coach sportif',
  'coaching fitness',
  'accompagnement physique',
  'remise en forme',
  'programme sportif personnalisé',
  'nutrition',
  'habitudes alimentaires',
  'préparation mentale',
  'motivation',
  'coaching à distance',
  'suivi de séances',
  'préinscription coaching',
  'perte de poids',
  'renforcement musculaire',
  'bien-être',
  'France',
].join(', ');

const CONTACT = 'annabelle.adel300@gmail.com';

export const mentionsLegales = {
  title: 'Mentions légales',
  description: 'Éditeur, contact et responsabilités du site Coach Adel.',
  blocks: [
    {
      title: 'Éditeur',
      paragraphs: [
        'Le site est édité par Coach Adel, coach en accompagnement global (activité physique, habitudes nutritionnelles et préparation mentale non thérapeutique).',
        `Contact : ${CONTACT}.`,
        'Le coaching proposé ne remplace ni un médecin, ni un diététicien, ni un psychologue.',
      ],
    },
    {
      title: 'Hébergement et sous-traitants',
      paragraphs: [
        'Le site est hébergé par le prestataire technique configuré pour cette application.',
        'Les e-mails transactionnels peuvent transiter par Brevo. Les images téléversées peuvent être stockées chez Cloudinary.',
      ],
    },
    {
      title: 'Propriété',
      paragraphs: [
        'Les textes, le nom Coach Adel et les visuels du site sont réservés à leur auteur. Toute réutilisation suppose une autorisation.',
      ],
    },
  ],
};

export const confidentialite = {
  title: 'Politique de confidentialité',
  description: 'Données collectées, finalités, durées de conservation et droits RGPD.',
  blocks: [
    {
      title: 'Responsable',
      paragraphs: [
        `Le responsable du traitement est Coach Adel, joignable à ${CONTACT}.`,
      ],
    },
    {
      title: 'Données collectées',
      paragraphs: [
        'Pré-inscription : nom, e-mail, téléphone facultatif, objectif facultatif, et la preuve de ton consentement.',
        'Compte sportif : identifiant, mot de passe haché, programmes, séances enregistrées et photos de progression si tu en déposes.',
        'Technique : cookie de session indispensable à la sécurité, journal d’erreurs sans mot de passe.',
      ],
    },
    {
      title: 'Pourquoi',
      paragraphs: [
        'Répondre à ta pré-inscription, ouvrir ton accès, suivre ton programme, sécuriser la connexion et envoyer les e-mails liés au service (validation, bienvenue, mot de passe).',
        'Aucune donnée n’est vendue. Aucun profilage publicitaire n’est fait.',
      ],
    },
    {
      title: 'Base légale',
      paragraphs: [
        'Pré-inscription : ton consentement, recueilli par une case non pré-cochée.',
        'Compte et suivi : exécution du service demandé.',
        'Sécurité du site : intérêt légitime (limitation des abus, session, jeton anti-falsification).',
      ],
    },
    {
      title: 'Durées',
      paragraphs: [
        'Demande de pré-inscription non aboutie : 3 ans après le dernier échange, puis suppression.',
        'Compte sportif : pendant l’accompagnement, puis 3 ans.',
        'Cookie de session : 7 jours d’inactivité.',
        'Journaux techniques : 12 mois.',
      ],
    },
    {
      title: 'Destinataires',
      paragraphs: [
        'Coach Adel, et les sous-traitants strictement nécessaires : envoi d’e-mails (Brevo) et stockage d’images (Cloudinary), lorsqu’ils sont activés.',
      ],
    },
    {
      title: 'Tes droits',
      paragraphs: [
        'Tu peux demander l’accès, la rectification, l’effacement, la limitation, l’opposition et la portabilité de tes données.',
        `Écris à ${CONTACT}. Tu peux aussi introduire une réclamation auprès de la CNIL (cnil.fr).`,
        'Retirer ton consentement n’affecte pas la licéité des traitements déjà réalisés.',
      ],
    },
    {
      title: 'Robots et agents automatiques',
      paragraphs: [
        'Les pages publiques peuvent être indexées par les moteurs de recherche. Les espaces privés (administration, compte, validation de pré-inscription) leur sont interdits.',
        'Les agents d’entraînement de modèles sont refusés. Le détail figure dans /robots.txt et /agents.xml. Cette consigne technique limite la collecte, elle ne la rend pas impossible si un robot l’ignore.',
      ],
    },
  ],
};

export const cookies = {
  title: 'Cookies',
  description: 'Cookies utilisés par Coach Adel et façon de les refuser.',
  blocks: [
    {
      title: 'Cookie indispensable',
      paragraphs: [
        'adel.sid : cookie de session, httpOnly, SameSite Lax. Il sert à la connexion, au jeton de sécurité des formulaires et aux messages flash. Durée : 7 jours. Il n’est pas utilisé pour la publicité.',
        'Aucun cookie de mesure d’audience, de réseau social ou de publicité n’est déposé.',
      ],
    },
    {
      title: 'Mémorisation locale',
      paragraphs: [
        'Après ton choix sur le bandeau, le navigateur garde la clé adel-consent dans le stockage local (ce n’est pas un cookie). Tu peux l’effacer dans les réglages du navigateur : le bandeau réapparaîtra.',
      ],
    },
    {
      title: 'Ton choix',
      paragraphs: [
        'Le bandeau informe de ce cookie indispensable. Il n’y a pas de cookie optionnel à accepter. Refuser le cookie de session empêche la connexion et l’envoi des formulaires sécurisés.',
      ],
    },
  ],
};
