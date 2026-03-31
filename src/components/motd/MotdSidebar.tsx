import React, { useState } from 'react';

type SidebarProps = {
  historico: string[];
  favoritas: string[];
  currentFrase?: string;
  onSelectFrase: (frase: string) => void;
  onToggleFavorite: (frase: string) => void;
  onClearHistory: () => void;
  onClearAll?: () => void;
};

export default function MotdSidebar({ 
  historico, 
  favoritas, 
  currentFrase,
  onSelectFrase, 
  onToggleFavorite, 
  onClearHistory,
  onClearAll 
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTipDetails, setShowTipDetails] = useState(false);

  // Filtro de busca - agora separa completamente as listas
  const filteredHistorico = historico.filter(frase => 
    frase.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredFavoritas = favoritas.filter(frase => 
    frase.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Lista atual baseada na tab ativa
  const currentList = activeTab === 'favorites' ? filteredFavoritas : filteredHistorico;
  const maxItems = 15; // Limite de itens visíveis
  const visibleItems = currentList.slice(0, maxItems);
  const hasMoreItems = currentList.length > maxItems;

  return (
    <aside className="motd-sidebar">
      {/* Sistema de abas estilo navegador */}
      <div className="sidebar-header">
        <div className="tab-buttons">
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              setSearchTerm('');
            }}
          >
            📜 Histórico ({historico.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites');
              setSearchTerm('');
            }}
          >
            ❤️ Favoritas ({favoritas.length})
          </button>
        </div>
        
        {/* Ações de limpeza integradas */}
        <div className="sidebar-actions">
          <button 
            className="clear-button" 
            onClick={onClearHistory}
            title="Limpar apenas histórico (preserva favoritas)"
          >
            🗑️
          </button>
          {onClearAll && (
            <button 
              className="clear-all-button" 
              onClick={onClearAll}
              title="Limpar TUDO (histórico, favoritas e estatísticas)"
            >
              💥
            </button>
          )}
        </div>
      </div>

      {/* Barra de busca */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder={`Buscar ${activeTab === 'favorites' ? 'favoritas' : 'histórico'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            className="clear-search"
            onClick={() => setSearchTerm('')}
            title="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>

      {/* Lista de frases */}
      <div className="phrases-container">
        <ul className="motd-history">
          {visibleItems.length > 0 ? (
            visibleItems.map((frase, index) => (
              <li 
                key={index} 
                className={currentFrase === frase ? 'current-phrase' : ''}
                onClick={() => onSelectFrase(frase)}
              >
                <span className="frase-text">{frase}</span>
                <button 
                  className={`mini-fav-btn ${favoritas.includes(frase) ? 'favorited' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(frase);
                  }}
                  title={favoritas.includes(frase) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  {favoritas.includes(frase) ? '❤️' : '🤍'}
                </button>
              </li>
            ))
          ) : (
            <li className="empty-state">
              {searchTerm ? (
                <span>
                  🔍 Nenhuma frase encontrada para &ldquo;{searchTerm}&rdquo;
                </span>
              ) : (
                <span>
                  {activeTab === 'favorites' 
                    ? '💔 Nenhuma frase favoritada ainda...' 
                    : '📝 Nenhuma frase gerada ainda...'
                  }
                </span>
              )}
            </li>
          )}
        </ul>

        {/* Indicador de mais itens */}
        {hasMoreItems && (
          <div className="more-items-indicator">
            +{currentList.length - maxItems} frases não exibidas
            <br />
            <small>Use a busca para encontrar frases específicas</small>
          </div>
        )}
      </div>

      {/* Dicas compactas com tooltips */}
      <div className="motd-tip">
        <div className="tip-section">
          💡 <strong>Atalhos:</strong>
          <br />
          • <kbd>Espaço</kbd> nova frase
          <br />
          • <kbd>F</kbd> favoritar • <kbd>C</kbd> copiar • <kbd>S</kbd> compartilhar
        </div>
        
        <div className="tip-section">
          <span 
            className="tip-toggle"
            onClick={() => setShowTipDetails(!showTipDetails)}
            style={{ cursor: 'pointer' }}
            title="Clique para ver detalhes sobre limpeza e funcionalidades"
          >
            ℹ️ <strong>Funcionalidades</strong> {showTipDetails ? '▼' : '▶'}
          </span>
          {showTipDetails && (
            <div className="tip-details">
              🛡️ <strong>Limpeza inteligente:</strong> preserva favoritas automaticamente
              <br />
              💥 <strong>Reset total:</strong> limpa histórico, favoritas e estatísticas
              <br />
              🚀 <strong>Sistema avançado:</strong> +35.000 combinações únicas (agora com humor!)
              <br />
              🔍 <strong>Busca inteligente:</strong> pesquise em tempo real
              <br />
              📊 <strong>Estatísticas:</strong> acompanhe seu progresso
              <br />
              ⚡ <strong>Performance:</strong> carregamento instantâneo
              <br />
              💾 <strong>Persistência:</strong> dados salvos no navegador
              <br />
              🎨 <strong>Temas:</strong> interface adaptativa claro/escuro
              <br />
              😄 <strong>Novidade:</strong> frases motivacionais com pitadas de humor
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
