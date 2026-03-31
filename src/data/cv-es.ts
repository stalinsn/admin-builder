import type { CvData } from '@/types/cv';

export const cvDataEs: CvData = {
  name: "Stalin Souza Nunes",
  githubProject: {
    url: "https://github.com/stalinsn/cv-stalin-nunes",
    label: "Este proyecto en Github"
  },
  title: "Especialista VTEX IO y Front-End Senior | ReactJS | TypeScript | Arquitectura de E-commerce y Web Full-Cycle",
  location: "São Paulo – SP, Brasil",
  contact: {
    phone: "+55 11 96367-2087",
    email: "stalinsn@hotmail.com",
    linkedin: "https://www.linkedin.com/in/stalin-souza-nunes-95748242/",
  },
  summary: `<strong>Desarrollador Web Senior</strong>, especialista en <strong>VTEX, ReactJS y TypeScript</strong>, con más de <strong>10 años de experiencia</strong> liderando proyectos de <strong>e-commerce, arquitectura de soluciones y desarrollo full-cycle</strong>.<br><br>Reconocido como <strong>referencia técnica</strong>, soy responsable de promover ambientes colaborativos, estables y productivos, impulsando el crecimiento del equipo y la entrega de valor estratégico para la empresa.<br><br>Mi trayectoria está marcada por la <strong>búsqueda continua de innovación</strong>, integración de nuevas tecnologías y mentalidad orientada a resultados. Transformo desafíos en oportunidades de evolución, convirtiendo esfuerzo en logros concretos para el negocio y para las personas a mi alrededor.`,

  coreSkills: [
    "Arquitectura de E-commerce (Headless, VTEX, Fast Store, API-First)",
    "Desarrollo Web Front-end (React, Next.js, TypeScript, JavaScript ES6+)",
    "Desarrollo Full-Cycle (Back-end, Front-end, DevOps y Automatización)",
    "Integración y Arquitectura de APIs (REST, GraphQL, Webhooks)",
    "Versionado, Git Flow y Patrones de Branches",
    "Liderazgo Técnico, Mentoría, Code Review y Cultura de Calidad",
    "Metodologías Ágiles (Scrum, Kanban, Lean)",
    "DevOps, CI/CD (Linux, Docker, GitHub Actions, GitLab CI)",
    "SEO Técnico, Performance, Observabilidad y Escalabilidad",
    "Documentación, Gestión del Conocimiento y Herramientas Colaborativas",
  ],

  technicalSkills: {
    "Front‑end":
      "ReactJS, Next.js, JavaScript ES6+, TypeScript, HTML5, CSS3, SASS, Styled Components, TailwindCSS",
    "E‑commerce": "VTEX IO, Fast Store, VTEX CMS, Loja Integrada, NuvemShop",
    "Back‑end": "Node.js, Strapi, PHP, APIs REST, GraphQL básico",
    DevOps: "GitHub Actions, GitLab CI, Linux (Nginx, PM2)",
    "Bases de Datos": "MySQL, PostgreSQL, SQLite",
    Otros:
      "Core Web Vitals (métricas de rendimiento y experiencia de usuario), SEO Técnico, A/B Testing, Arquitectura Headless, Performance, Escalabilidad, Bookstack, JIRA, Teams",
  },

  languages: [
    { name: "Portugués", level: "Nativo" },
    {
      name: "Inglés",
      level: "Avanzado (Lectura, escritura y conversación técnica)",
    },
    {
      name: "Español",
      level: "Intermedio (Conversación técnica y lectura)",
    },
  ],

  experience: [
    {
      company: "Stefanini Brasil",
      role: "Analista Desarrollador Sr. | Especialista VTEX (IO, Fast Store)",
      period: "Jul 2022 – Actual",
      location: "São Paulo – SP",
      bullets: [
        "Liderazgo técnico en squads de e-commerce, definiendo arquitectura escalable, buenas prácticas y estrategias de desarrollo con VTEX IO y Fast Store.",
        "Protagonista en proyectos estratégicos, liderando entregas de alto impacto para grandes marcas y garantizando integración eficiente entre equipos.",
        "Implementación de pipelines CI/CD con GitHub Actions, aumentando en un 40% la eficiencia de los ciclos de QA y producción.",
        "Modernización de tiendas multimarcas a arquitectura headless, reduciendo en un 30% el tiempo de entrega y aumentando la estabilidad en producción.",
        "Mentoría activa y desarrollo de talentos, elevando la calidad técnica y reduciendo el retrabajo en más del 90%.",
        "Actuación directa en troubleshooting, despliegue, mantenimiento evolutivo y soporte de código, siempre con foco en performance, innovación y evolución del negocio.",
      ],
    },
    {
      company: "Tok&Stok",
      role: "Analista Desarrollador Web VTEX CMS/IO",
      period: "Oct 2020 – Jun 2022",
      location: "São Paulo – SP",
      bullets: [
        "Participación activa en la migración de la plataforma de VTEX Legacy a VTEX IO, contribuyendo a la modernización de la arquitectura e interfaces.",
        "Desarrollo de nuevas PDPs, Homepages y features, resultando en una ganancia de +18% en performance (page speed).",
        "Participación en la planificación de soluciones, revisión de código y definición de mejores prácticas junto al equipo.",
        "Colaboración en el mantenimiento y mejora de los procesos de versionado (Git Flow), contribuyendo a la reducción de fallos de integración y mejora de la calidad del código.",
      ],
    },
    {
      company: "EzLogic Tecnologia",
      role: "Desarrollador Web VTEX",
      period: "May 2020 – Oct 2020",
      location: "São Paulo – SP",
      bullets: [
        "Desarrollo y mantenimiento de features personalizadas para tiendas VTEX, con foco en UX, SEO técnico y performance.",
        "Implementación de funcionalidades, ajustes de diseño, corrección de bugs y adecuación a las reglas de negocio.",
        "Actuación en grandes proyectos como Vivo, Claro Promo, Usaflex, Tupperware, Loja Avenida, American Pet, Payot y Linea Alimentos.",
      ],
    },
    {
      company: "Elocc Effective Business Builder",
      role: "Desarrollador Web Ecommerces",
      period: "Ago 2019 – Feb 2020",
      location: "São Paulo – SP",
      bullets: [
        "Desarrollo, mantenimiento e implementación de tiendas en VTEX, WooCommerce y plataformas propias.",
        "Mejora de diseño, implementación de nuevas funcionalidades, ajustes y corrección de bugs.",
        "Participación en proyectos de grandes marcas como Copag, Cafe Store, Kenner, MyBasic, OxuaBeach, Casa da Arte, Dular y Drogafuji.",
      ],
    },
    {
      company: "Enext, a VML Company",
      role: "Desarrollador Web Front End",
      period: "Nov 2018 – Feb 2019",
      location: "São Paulo – SP",
      bullets: [
        "Desarrollo de páginas y componentes para e-commerce en la plataforma VTEX.",
        "Mejora de diseño, implementación de funcionalidades, ajustes y corrección de bugs.",
        "Actuación en el equipo de proyectos, garantizando calidad de entrega y adherencia a los layouts UI/UX.",
      ],
    },
    {
      company: "MPPIT Information Technology",
      role: "Técnico de Informática y Desarrollador Web",
      period: "Feb 2013 – Oct 2018",
      location: "São Paulo – SP",
      bullets: [
        "Actuación inicial como técnico de informática (soporte a hardware, redes y usuarios).",
        "Transición a desarrollador web en los últimos tres años, creando y manteniendo sistemas internos basados en PHP.",
        "Implementación de funcionalidades, ajustes de diseño, corrección de bugs y soporte técnico para equipos extranjeros.",
        "Responsable de mantenimiento de servidores, infraestructura TI y troubleshooting de hardware/software.",
      ],
    },
    {
      company: "Artmeta Informatica",
      role: "Técnico Especialista",
      period: "Ago 2011 – Jan 2013",
      location: "São Paulo – SP",
      bullets: [
        "Técnico en mantenimiento de hardware, soporte a usuarios y especialista en desarrollo web y mantenimiento de sistemas operativos.",
        "Mejora de diseño, implementación de funcionalidades, ajustes y corrección de bugs en sistemas internos.",
        "Atención técnica de alto nivel para clientes y mantenimiento de infraestructura tecnológica.",
      ],
    },
  ],

  education: [
    {
      institution: "Universidade Anhanguera São Paulo",
      degree: "Licenciatura en Ingeniería de Software (en curso)",
      period: "2024 – 2028",
      details:
        "Formación orientada a arquitectura de software, ingeniería de requisitos, desarrollo web fullstack y prácticas modernas de DevOps. Énfasis en proyectos prácticos, innovación y aplicación de metodologías ágiles.",
    },
    {
      institution: "Escola Estadual Eusébio de Paula Marcondes",
      degree: "Educación Secundaria",
      period: "2004 – 2007",
      details: "Formación básica concluida."
    },
  ],

  interests: [
    "Arquitectura de Software y Soluciones Innovadoras",
    "Liderazgo Técnico y Mentoría de Equipos",
    "Desarrollo de Proyectos Internacionales y Remotos",
    "E-commerce de Alto Rendimiento",
    "Open-source, Comunidades de Desarrollo y Compartir Conocimiento",
    "Automatización, Inteligencia Artificial y Nuevas Tecnologías",
    "Educación, Producción de Contenido y Participación en Comunidades Técnicas"
  ],
};
