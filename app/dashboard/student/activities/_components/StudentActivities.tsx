'use client';

import { useState } from 'react';
import { EmptyState } from '@/components/Feedback/Feedback';
import { IconInfo } from '@/components/Icones/Icones';
import type { ActivityType, Axis } from '@/lib/types';
import { AXES } from '@/lib/types';
import styles from './StudentActivities.module.css';

interface Props {
  rules: ActivityType[];
}

/**
 * Visualização somente-leitura das regras de atividades para o aluno.
 * Permite filtrar por eixo para que o estudante localize rapidamente
 * o que precisa entregar.
 */
export function StudentActivities({ rules }: Props) {
  const [axisFilter, setAxisFilter] = useState<Axis | 'all'>('all');

  const filtered = axisFilter === 'all'
    ? rules
    : rules.filter((r) => r.axis === axisFilter);

  /* Contagem por eixo para exibir nos filtros */
  const countByAxis = AXES.reduce<Record<string, number>>((acc, axis) => {
    acc[axis] = rules.filter((r) => r.axis === axis).length;
    return acc;
  }, {});

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Regras de atividades</h2>
          <p className={styles.subtitle}>
            Consulte as atividades complementares aceitas, a carga horária mínima e máxima de cada
            tipo, e o comprovante exigido.
          </p>
        </div>
      </header>

      {/* Filtros por eixo */}
      <div className={styles.filters} role="group" aria-label="Filtrar por eixo">
        <button
          type="button"
          className={`${styles.filterBtn} ${axisFilter === 'all' ? styles.filterActive : ''}`}
          onClick={() => setAxisFilter('all')}
          aria-pressed={axisFilter === 'all'}
        >
          Todos ({rules.length})
        </button>
        {AXES.map((axis) => (
          <button
            key={axis}
            type="button"
            className={`${styles.filterBtn} ${axisFilter === axis ? styles.filterActive : ''}`}
            onClick={() => setAxisFilter(axis)}
            aria-pressed={axisFilter === axis}
          >
            {axis} ({countByAxis[axis]})
          </button>
        ))}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="Nenhuma regra cadastrada"
          hint="A coordenação ainda não configurou regras de atividades complementares."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma atividade neste eixo"
          hint="Tente outro filtro ou consulte todos os eixos."
        />
      ) : (
        <>
          {/* Tabela para desktop */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Eixo</th>
                  <th>Atividade</th>
                  <th>Mínimo</th>
                  <th>Teto</th>
                  <th>Comprovante exigido</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Eixo"><span className={styles.tag}>{r.axis}</span></td>
                    <td data-label="Atividade">{r.description}</td>
                    <td data-label="Mínimo">{r.minHours} h</td>
                    <td data-label="Teto">{r.maxHours} h</td>
                    <td data-label="Comprovante">{r.proofType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartões para mobile (≤968px) — renderizados via CSS */}
          <div className={styles.cardList}>
            {filtered.map((r) => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.tag}>{r.axis}</span>
                </div>
                <h3 className={styles.cardTitle}>{r.description}</h3>
                <div className={styles.cardDetails}>
                  <div className={styles.cardDetail}>
                    <span className={styles.cardDetailLabel}>Mínimo</span>
                    <span className={styles.cardDetailValue}>{r.minHours} h</span>
                  </div>
                  <div className={styles.cardDetail}>
                    <span className={styles.cardDetailLabel}>Teto</span>
                    <span className={styles.cardDetailValue}>{r.maxHours} h</span>
                  </div>
                </div>
                <div className={styles.cardProof}>
                  <span className={styles.cardDetailLabel}>Comprovante</span>
                  <span>{r.proofType}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dica informativa */}
      <div className={styles.infoBox}>
        <IconInfo size={18} />
        <p>
          As horas informadas no certificado serão validadas pela coordenação com base nestas
          regras. Valores abaixo do mínimo ou acima do teto podem ser ajustados ou rejeitados.
        </p>
      </div>
    </div>
  );
}
