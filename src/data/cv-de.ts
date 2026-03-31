import type { CvData } from '@/types/cv';

export const cvDataDe: CvData = {
  name: "Stalin Souza Nunes",
  githubProject: {
    url: "https://github.com/stalinsn/cv-stalin-nunes",
    label: "Dieses Projekt auf Github"
  },
  title: "VTEX IO Spezialist & Senior Front-End | ReactJS | TypeScript | E-Commerce & Full-Cycle Web Architektur",
  location: "São Paulo – SP, Brasilien",
  contact: {
    phone: "+55 11 96367-2087",
    email: "stalinsn@hotmail.com",
    linkedin: "https://www.linkedin.com/in/stalin-souza-nunes-95748242/",
  },
  summary: `<strong>Senior Webentwickler</strong>, Spezialist für <strong>VTEX, ReactJS und TypeScript</strong>, mit über <strong>10 Jahren Erfahrung</strong> in der Leitung von <strong>E-Commerce-Projekten, Lösungsarchitektur und Full-Cycle-Entwicklung</strong>.<br><br>Anerkannt als <strong>technische Referenz</strong>, fördere ich kollaborative, stabile und produktive Umgebungen, unterstütze das Wachstum des Teams und liefere strategischen Mehrwert für das Unternehmen.<br><br>Mein Werdegang ist geprägt von <strong>kontinuierlicher Innovationssuche</strong>, Integration neuer Technologien und einer ergebnisorientierten Denkweise. Ich verwandle Herausforderungen in Entwicklungschancen und mache aus Einsatz konkrete Erfolge für das Unternehmen und die Menschen um mich herum.`,

  coreSkills: [
    "E-Commerce-Architektur (Headless, VTEX, Fast Store, API-First)",
    "Front-End Webentwicklung (React, Next.js, TypeScript, JavaScript ES6+)",
    "Full-Cycle-Entwicklung (Back-End, Front-End, DevOps und Automatisierung)",
    "API-Integration und Architektur (REST, GraphQL, Webhooks)",
    "Versionierung, Git Flow und Branch-Standards",
    "Technische Führung, Mentoring, Code Review und Qualitätskultur",
    "Agile Methoden (Scrum, Kanban, Lean)",
    "DevOps, CI/CD (Linux, Docker, GitHub Actions, GitLab CI)",
    "Technisches SEO, Performance, Observability und Skalierbarkeit",
    "Dokumentation, Wissensmanagement und Kollaborationstools",
  ],

  technicalSkills: {
    "Front‑end":
      "ReactJS, Next.js, JavaScript ES6+, TypeScript, HTML5, CSS3, SASS, Styled Components, TailwindCSS",
    "E‑commerce": "VTEX IO, Fast Store, VTEX CMS, Loja Integrada, NuvemShop",
    "Back‑end": "Node.js, Strapi, PHP, REST-APIs, Grundkenntnisse GraphQL",
    DevOps: "GitHub Actions, GitLab CI, Linux (Nginx, PM2)",
    "Datenbanken": "MySQL, PostgreSQL, SQLite",
    Sonstiges:
      "Core Web Vitals (Leistungs- und Nutzererfahrungsmetriken), Technisches SEO, A/B Testing, Headless-Architektur, Performance, Skalierbarkeit, Bookstack, JIRA, Teams",
  },

  languages: [
    { name: "Portugiesisch", level: "Muttersprache" },
    {
      name: "Englisch",
      level: "Fortgeschritten (Lesen, Schreiben und technische Konversation)",
    },
    {
      name: "Spanisch",
      level: "Mittelstufe (Technische Konversation und Lesen)",
    },
  ],

  experience: [
    {
      company: "Stefanini Brasil",
      role: "Senior Entwickler | VTEX Spezialist (IO, Fast Store)",
      period: "Jul 2022 – Heute",
      location: "São Paulo – SP",
      bullets: [
        "Technische Leitung in E-Commerce-Squads, Definition skalierbarer Architektur, Best Practices und Entwicklungsstrategien mit VTEX IO und Fast Store.",
        "Schlüsselrolle in strategischen Projekten, Leitung von High-Impact-Lieferungen für große Marken und Sicherstellung effizienter Integration zwischen Teams.",
        "Implementierung von CI/CD-Pipelines mit GitHub Actions, Steigerung der Effizienz der QA- und Produktionszyklen um 40%.",
        "Modernisierung von Multimarken-Shops auf Headless-Architektur, Reduzierung der Lieferzeit um 30% und Erhöhung der Produktionsstabilität.",
        "Aktives Mentoring und Talententwicklung, Steigerung der technischen Qualität und Reduzierung von Nacharbeit um über 90%.",
        "Direkte Beteiligung an Troubleshooting, Deployment, Weiterentwicklung und Code-Support, stets mit Fokus auf Performance, Innovation und Geschäftsentwicklung.",
      ],
    },
    {
      company: "Tok&Stok",
      role: "Webentwickler VTEX CMS/IO",
      period: "Okt 2020 – Jun 2022",
      location: "São Paulo – SP",
      bullets: [
        "Aktive Teilnahme an der Migration von VTEX Legacy zu VTEX IO, Beitrag zur Modernisierung der Architektur und Schnittstellen.",
        "Entwicklung neuer PDPs, Homepages und Features, mit einem Performancegewinn von +18% (Page Speed).",
        "Beteiligung an der Lösungsplanung, Code Review und Definition von Best Practices im Team.",
        "Mitarbeit an der Pflege und Verbesserung der Versionierungsprozesse (Git Flow), Beitrag zur Reduzierung von Integrationsfehlern und Verbesserung der Codequalität.",
      ],
    },
    {
      company: "EzLogic Tecnologia",
      role: "Webentwickler VTEX",
      period: "Mai 2020 – Okt 2020",
      location: "São Paulo – SP",
      bullets: [
        "Entwicklung und Wartung von kundenspezifischen Features für VTEX-Shops mit Fokus auf UX, technisches SEO und Performance.",
        "Implementierung von Funktionalitäten, Designanpassungen, Bugfixes und Anpassung an Geschäftsregeln.",
        "Mitarbeit an großen Projekten wie Vivo, Claro Promo, Usaflex, Tupperware, Loja Avenida, American Pet, Payot und Linea Alimentos.",
      ],
    },
    {
      company: "Elocc Effective Business Builder",
      role: "Webentwickler Ecommerces",
      period: "Aug 2019 – Feb 2020",
      location: "São Paulo – SP",
      bullets: [
        "Entwicklung, Wartung und Implementierung von Shops in VTEX, WooCommerce und proprietären Plattformen.",
        "Designverbesserung, Implementierung neuer Features, Anpassungen und Bugfixes.",
        "Mitarbeit an Projekten für große Marken wie Copag, Cafe Store, Kenner, MyBasic, OxuaBeach, Casa da Arte, Dular und Drogafuji.",
      ],
    },
    {
      company: "Enext, a VML Company",
      role: "Front End Webentwickler",
      period: "Nov 2018 – Feb 2019",
      location: "São Paulo – SP",
      bullets: [
        "Entwicklung von Seiten und Komponenten für E-Commerce auf der VTEX-Plattform.",
        "Designverbesserung, Implementierung von Features, Anpassungen und Bugfixes.",
        "Mitarbeit im Projektteam, Sicherstellung der Lieferqualität und Einhaltung von UI/UX-Layouts.",
      ],
    },
    {
      company: "MPPIT Information Technology",
      role: "IT-Techniker und Webentwickler",
      period: "Feb 2013 – Okt 2018",
      location: "São Paulo – SP",
      bullets: [
        "Beginn als IT-Techniker (Hardware-, Netzwerk- und Benutzersupport).",
        "Wechsel zum Webentwickler in den letzten drei Jahren, Erstellung und Wartung interner Systeme auf PHP-Basis.",
        "Implementierung von Features, Designanpassungen, Bugfixes und technischer Support für ausländische Teams.",
        "Verantwortlich für Serverwartung, IT-Infrastruktur und Fehlerbehebung bei Hardware/Software.",
      ],
    },
    {
      company: "Artmeta Informatica",
      role: "Fachtechniker",
      period: "Aug 2011 – Jan 2013",
      location: "São Paulo – SP",
      bullets: [
        "Techniker für Hardwarewartung, Benutzersupport und Spezialist für Webentwicklung und Betriebssystemwartung.",
        "Designverbesserung, Implementierung von Features, Anpassungen und Bugfixes in internen Systemen.",
        "Hochwertiger technischer Support für Kunden und Wartung der technologischen Infrastruktur.",
      ],
    },
  ],

  education: [
    {
      institution: "Universidade Anhanguera São Paulo",
      degree: "Bachelor in Software Engineering (laufend)",
      period: "2024 – 2028",
      details:
        "Studium mit Schwerpunkt auf Softwarearchitektur, Anforderungsmanagement, Fullstack-Webentwicklung und modernen DevOps-Praktiken. Fokus auf praxisnahe Projekte, Innovation und Anwendung agiler Methoden.",
    },
    {
      institution: "Escola Estadual Eusébio de Paula Marcondes",
      degree: "Abitur",
      period: "2004 – 2007",
      details: "Abgeschlossene Grundausbildung."
    },
  ],

  interests: [
    "Softwarearchitektur und innovative Lösungen",
    "Technische Führung und Team-Mentoring",
    "Entwicklung internationaler und Remote-Projekte",
    "Hochleistungs-E-Commerce",
    "Open-Source, Entwickler-Communities und Wissensaustausch",
    "Automatisierung, Künstliche Intelligenz und neue Technologien",
    "Bildung, Content-Produktion und Engagement in technischen Communities"
  ],
};
