import React, { useState } from "react";
import styles from "../styles/CompetenciasNuvem.module.css";

type CompetenciasNuvemProps = {
  competencias: string[];
};

const exemplos: Record<string, string> = {
  "Arquitetura de E-commerce (Headless, VTEX IO, API-First)":
    "Experiência em estruturar soluções escaláveis, integrando múltiplas plataformas e APIs.",
  "Desenvolvimento Web Front-end (React, Next.js, TypeScript)":
    "Implementação de interfaces modernas, responsivas e de alta performance.",
  "Full-Cycle Development (Back-end, Front-end e DevOps)":
    "Atuação em todas as etapas do ciclo de desenvolvimento, do planejamento ao deploy.",
  "Integração e Arquitetura de APIs (REST / GraphQL)":
    "Projetos com integrações robustas, garantindo comunicação eficiente entre sistemas.",
  "Versionamento, Git Flow e Padrões de Branches":
    "Organização de fluxos de trabalho colaborativos e seguros.",
  "Liderança Técnica, Mentoria e Code Review":
    "Mentoria de times, definição de padrões e revisão de código para excelência técnica.",
  "Metodologias Ágeis (Scrum, Kanban)":
    "Gestão de projetos com foco em entregas rápidas e melhoria contínua.",
  "DevOps, CI/CD (Linux, Docker, GitHub Actions)":
    "Automação de deploys, integração contínua e infraestrutura eficiente.",
};

export default function CompetenciasNuvem({
  competencias,
}: CompetenciasNuvemProps) {
  const [info, setInfo] = useState<number | null>(null);

  return (
    <div className={styles.nuvemContainer}>
      <h2>Competências Principais</h2>
      <div className={styles.nuvem}>
        {competencias.map((palavra, idx) => (
          <span
            key={palavra}
            className={styles.nuvemItem}
            onClick={() => setInfo(idx)}
            tabIndex={0}
            role="button"
            aria-label={`Mais informações sobre ${palavra}`}
          >
            {palavra}
          </span>
        ))}
      </div>
      {info !== null && (
        <div className={styles.infoBox}>
          <strong>{competencias[info]}</strong>
          <p>
            {exemplos[competencias[info]] ||
              "Competência essencial para o sucesso em projetos de tecnologia."}
          </p>
          <button onClick={() => setInfo(null)}>Fechar</button>
        </div>
      )}
    </div>
  );
}
