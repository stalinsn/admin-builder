import type { CvData } from '@/types/cv';

export const cvDataFr: CvData = {
  name: "Stalin Souza Nunes",
  githubProject: {
    url: "https://github.com/stalinsn/cv-stalin-nunes",
    label: "Ce projet sur Github"
  },
  title: "Spécialiste VTEX IO & Front-End Senior | ReactJS | TypeScript | Architecture E-commerce & Web Full-Cycle",
  location: "São Paulo – SP, Brésil",
  contact: {
    phone: "+55 11 96367-2087",
    email: "stalinsn@hotmail.com",
    linkedin: "https://www.linkedin.com/in/stalin-souza-nunes-95748242/",
  },
  summary: `<strong>Développeur Web Senior</strong>, spécialiste en <strong>VTEX, ReactJS et TypeScript</strong>, avec plus de <strong>10 ans d'expérience</strong> à la tête de projets de <strong>e-commerce, architecture de solutions et développement full-cycle</strong>.<br><br>Reconnu comme <strong>référence technique</strong>, je favorise des environnements collaboratifs, stables et productifs, stimulant la croissance de l'équipe et la livraison de valeur stratégique pour l'entreprise.<br><br>Mon parcours est marqué par une <strong>quête continue d'innovation</strong>, l'intégration de nouvelles technologies et une mentalité orientée résultats. Je transforme les défis en opportunités d'évolution, convertissant l'effort en réalisations concrètes pour l'entreprise et les personnes autour de moi.`,

  coreSkills: [
    "Architecture E-commerce (Headless, VTEX, Fast Store, API-First)",
    "Développement Web Front-end (React, Next.js, TypeScript, JavaScript ES6+)",
    "Développement Full-Cycle (Back-end, Front-end, DevOps et Automatisation)",
    "Intégration et Architecture d'APIs (REST, GraphQL, Webhooks)",
    "Gestion de versions, Git Flow et modèles de branches",
    "Leadership technique, mentorat, revue de code et culture qualité",
    "Méthodologies Agiles (Scrum, Kanban, Lean)",
    "DevOps, CI/CD (Linux, Docker, GitHub Actions, GitLab CI)",
    "SEO Technique, Performance, Observabilité et Scalabilité",
    "Documentation, Gestion des Connaissances et Outils Collaboratifs",
  ],

  technicalSkills: {
    "Front‑end":
      "ReactJS, Next.js, JavaScript ES6+, TypeScript, HTML5, CSS3, SASS, Styled Components, TailwindCSS",
    "E‑commerce": "VTEX IO, Fast Store, VTEX CMS, Loja Integrada, NuvemShop",
    "Back‑end": "Node.js, Strapi, PHP, APIs REST, GraphQL basique",
    DevOps: "GitHub Actions, GitLab CI, Linux (Nginx, PM2)",
    "Bases de Données": "MySQL, PostgreSQL, SQLite",
    Autres:
      "Core Web Vitals (métriques de performance et expérience utilisateur), SEO Technique, A/B Testing, Architecture Headless, Performance, Scalabilité, Bookstack, JIRA, Teams",
  },

  languages: [
    { name: "Portugais", level: "Natif" },
    {
      name: "Anglais",
      level: "Avancé (Lecture, écriture et conversation technique)",
    },
    {
      name: "Espagnol",
      level: "Intermédiaire (Conversation technique et lecture)",
    },
  ],

  experience: [
    {
      company: "Stefanini Brasil",
      role: "Développeur Senior | Spécialiste VTEX (IO, Fast Store)",
      period: "Juil 2022 – Présent",
      location: "São Paulo – SP",
      bullets: [
        "Leadership technique dans des squads e-commerce, définition d'architectures évolutives, bonnes pratiques et stratégies de développement avec VTEX IO et Fast Store.",
        "Acteur clé dans des projets stratégiques, menant des livraisons à fort impact pour de grandes marques et garantissant une intégration efficace entre les équipes.",
        "Mise en place de pipelines CI/CD avec GitHub Actions, augmentant de 40% l'efficacité des cycles QA et production.",
        "Modernisation de boutiques multimarques vers une architecture headless, réduisant de 30% le temps de livraison et augmentant la stabilité en production.",
        "Mentorat actif et développement de talents, élevant la qualité technique et réduisant la reprise de plus de 90%.",
        "Intervention directe sur le troubleshooting, le déploiement, la maintenance évolutive et le support du code, toujours avec un focus sur la performance, l'innovation et l'évolution du business.",
      ],
    },
    {
      company: "Tok&Stok",
      role: "Développeur Web VTEX CMS/IO",
      period: "Oct 2020 – Juin 2022",
      location: "São Paulo – SP",
      bullets: [
        "Participation active à la migration de la plateforme VTEX Legacy vers VTEX IO, contribuant à la modernisation de l'architecture et des interfaces.",
        "Développement de nouvelles PDP, homepages et fonctionnalités, aboutissant à un gain de +18% en performance (page speed).",
        "Participation à la planification des solutions, revue de code et définition des meilleures pratiques avec l'équipe.",
        "Collaboration à la maintenance et à l'amélioration des processus de gestion de versions (Git Flow), contribuant à la réduction des erreurs d'intégration et à l'amélioration de la qualité du code.",
      ],
    },
    {
      company: "EzLogic Tecnologia",
      role: "Développeur Web VTEX",
      period: "Mai 2020 – Oct 2020",
      location: "São Paulo – SP",
      bullets: [
        "Développement et maintenance de fonctionnalités personnalisées pour boutiques VTEX, avec un focus sur l'UX, le SEO technique et la performance.",
        "Implémentation de fonctionnalités, ajustements de design, corrections de bugs et adaptation aux règles métier.",
        "Participation à de grands projets comme Vivo, Claro Promo, Usaflex, Tupperware, Loja Avenida, American Pet, Payot et Linea Alimentos.",
      ],
    },
    {
      company: "Elocc Effective Business Builder",
      role: "Développeur Web Ecommerces",
      period: "Août 2019 – Fév 2020",
      location: "São Paulo – SP",
      bullets: [
        "Développement, maintenance et implémentation de boutiques sur VTEX, WooCommerce et plateformes propriétaires.",
        "Amélioration du design, implémentation de nouvelles fonctionnalités, ajustements et corrections de bugs.",
        "Participation à des projets de grandes marques comme Copag, Cafe Store, Kenner, MyBasic, OxuaBeach, Casa da Arte, Dular et Drogafuji.",
      ],
    },
    {
      company: "Enext, a VML Company",
      role: "Développeur Web Front End",
      period: "Nov 2018 – Fév 2019",
      location: "São Paulo – SP",
      bullets: [
        "Développement de pages et composants pour e-commerce sur la plateforme VTEX.",
        "Amélioration du design, implémentation de fonctionnalités, ajustements et corrections de bugs.",
        "Participation à l'équipe projet, garantissant la qualité des livraisons et l'adhésion aux layouts UI/UX.",
      ],
    },
    {
      company: "MPPIT Information Technology",
      role: "Technicien Informatique et Développeur Web",
      period: "Fév 2013 – Oct 2018",
      location: "São Paulo – SP",
      bullets: [
        "Début de carrière comme technicien informatique (support hardware, réseaux et utilisateurs).",
        "Transition vers développeur web les trois dernières années, création et maintenance de systèmes internes basés sur PHP.",
        "Implémentation de fonctionnalités, ajustements de design, corrections de bugs et support technique pour des équipes étrangères.",
        "Responsable de la maintenance des serveurs, de l'infrastructure IT et du troubleshooting hardware/software.",
      ],
    },
    {
      company: "Artmeta Informatica",
      role: "Technicien Spécialiste",
      period: "Août 2011 – Jan 2013",
      location: "São Paulo – SP",
      bullets: [
        "Technicien en maintenance hardware, support aux utilisateurs et spécialiste en développement web et maintenance de systèmes d'exploitation.",
        "Amélioration du design, implémentation de fonctionnalités, ajustements et corrections de bugs sur des systèmes internes.",
        "Support technique de haut niveau pour les clients et maintenance de l'infrastructure technologique.",
      ],
    },
  ],

  education: [
    {
      institution: "Universidade Anhanguera São Paulo",
      degree: "Licence en Ingénierie Logicielle (en cours)",
      period: "2024 – 2028",
      details:
        "Formation axée sur l'architecture logicielle, l'ingénierie des exigences, le développement web fullstack et les pratiques modernes de DevOps. Accent sur les projets pratiques, l'innovation et l'application de méthodologies agiles.",
    },
    {
      institution: "Escola Estadual Eusébio de Paula Marcondes",
      degree: "Enseignement Secondaire",
      period: "2004 – 2007",
      details: "Formation de base complétée."
    },
  ],

  interests: [
    "Architecture Logicielle et Solutions Innovantes",
    "Leadership Technique et Mentorat d'Équipes",
    "Développement de Projets Internationaux et à Distance",
    "E-commerce Haute Performance",
    "Open-source, Communautés de Développement et Partage de Connaissances",
    "Automatisation, Intelligence Artificielle et Nouvelles Technologies",
    "Éducation, Production de Contenu et Engagement dans les Communautés Techniques"
  ],
};
