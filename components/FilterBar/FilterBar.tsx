import { useId, useMemo } from 'react';
import { IconSearch, IconX } from '@/components/Icones/Icones';
import {
  AXES,
  type ActivityType,
  type Axis,
  type CertificateFilterState,
  type CertificateStatus,
} from '@/lib/types';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  filters: CertificateFilterState;
  onChange: (next: CertificateFilterState) => void;
  rules: ActivityType[];
  totalCount: number;
  filteredCount: number;
  statusCounts?: Record<CertificateStatus | 'all', number>;
  onReset: () => void;
  placeholder?: string;
}

const STATUS_OPTIONS: { key: CertificateStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Em análise' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Rejeitados' },
];

export function FilterBar({
  filters,
  onChange,
  rules,
  totalCount,
  filteredCount,
  statusCounts,
  onReset,
  placeholder = 'Buscar por título ou atividade…',
}: FilterBarProps) {
  const searchId = useId();
  const axisId = useId();
  const typeId = useId();

  // Atividades disponíveis para o select, filtradas pelo eixo caso algum esteja selecionado
  const availableRules = useMemo(() => {
    if (filters.axis === 'all') return rules;
    return rules.filter((r) => r.axis === filters.axis);
  }, [rules, filters.axis]);

  const hasActiveFilters =
    filters.axis !== 'all' ||
    filters.activityTypeId !== 'all' ||
    filters.status !== 'all' ||
    filters.query.trim().length > 0;

  function handleAxisChange(newAxis: Axis | 'all') {
    // Se o tipo selecionado anteriormente não pertencer ao novo eixo, reseta o tipo para 'all'
    let nextTypeId = filters.activityTypeId;
    if (newAxis !== 'all' && nextTypeId !== 'all') {
      const selectedRule = rules.find((r) => r.id === nextTypeId);
      if (selectedRule && selectedRule.axis !== newAxis) {
        nextTypeId = 'all';
      }
    }
    onChange({ ...filters, axis: newAxis, activityTypeId: nextTypeId });
  }

  function handleTypeChange(newTypeId: string) {
    // Se selecionar uma atividade específica, sincroniza o eixo correspondente automaticamente
    let nextAxis = filters.axis;
    if (newTypeId !== 'all') {
      const selectedRule = rules.find((r) => r.id === newTypeId);
      if (selectedRule) {
        nextAxis = selectedRule.axis;
      }
    }
    onChange({ ...filters, activityTypeId: newTypeId, axis: nextAxis });
  }

  return (
    <div className={styles.container} role="search" aria-label="Filtros de certificados">
      {/* Linha principal de controles */}
      <div className={styles.controlsRow}>
        {/* Campo de pesquisa combinada por texto */}
        <div className={styles.searchWrapper}>
          <IconSearch size={16} className={styles.searchIcon} />
          <input
            id={searchId}
            type="search"
            className={styles.searchInput}
            placeholder={placeholder}
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            aria-label="Pesquisar por título do certificado ou nome da atividade"
          />
          {filters.query && (
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => onChange({ ...filters, query: '' })}
              aria-label="Limpar pesquisa"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Seletor de Eixo */}
        <div className={styles.selectWrapper}>
          <label htmlFor={axisId} className="sr-only">Filtrar por eixo</label>
          <select
            id={axisId}
            className={styles.selectInput}
            value={filters.axis}
            onChange={(e) => handleAxisChange(e.target.value as Axis | 'all')}
          >
            <option value="all">Todos os eixos</option>
            {AXES.map((axis) => (
              <option key={axis} value={axis}>{axis}</option>
            ))}
          </select>
        </div>

        {/* Seletor de Tipo Específico de Atividade */}
        <div className={styles.selectWrapper}>
          <label htmlFor={typeId} className="sr-only">Filtrar por tipo de atividade</label>
          <select
            id={typeId}
            className={styles.selectInput}
            value={filters.activityTypeId}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="all">Todas as atividades</option>
            {availableRules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.description} ({rule.axis})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Abas de Situação / Status */}
      <div className={styles.statusRow}>
        <div className={styles.statusTabs} role="group" aria-label="Filtrar por situação">
          {STATUS_OPTIONS.map((st) => {
            const isSelected = filters.status === st.key;
            const count = statusCounts ? statusCounts[st.key] : undefined;
            return (
              <button
                key={st.key}
                type="button"
                className={`${styles.statusTab} ${isSelected ? styles.statusTabActive : ''}`}
                onClick={() => onChange({ ...filters, status: st.key })}
                aria-pressed={isSelected}
              >
                <span>{st.label}</span>
                {typeof count === 'number' && (
                  <span className={styles.statusCount}>({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Resumo e Botão de Limpar */}
        <div className={styles.metaRow}>
          <span className={styles.countText} role="status" aria-live="polite">
            {filteredCount === totalCount ? (
              <>{totalCount} {totalCount === 1 ? 'certificado' : 'certificados'}</>
            ) : (
              <>Mostrando <strong>{filteredCount}</strong> de {totalCount} certificados</>
            )}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={onReset}
              title="Restaurar todos os filtros"
            >
              <IconX size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
