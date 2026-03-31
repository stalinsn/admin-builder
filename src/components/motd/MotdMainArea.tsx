import React from 'react';
import MotdStats from './MotdStats';
import MotdActionButtons from './MotdActionButtons';

type MainAreaProps = {
  frase: string;
  fadeClass: string;
  stats: { total: number; hoje: number; streak: number };
  isFavorited: boolean;
  aviso: string;
  onGenerateNew: () => void;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onShare: () => void;
  onClick: () => void;
};

export default function MotdMainArea({
  frase,
  fadeClass,
  stats,
  isFavorited,
  aviso,
  onGenerateNew,
  onToggleFavorite,
  onCopy,
  onShare,
  onClick
}: MainAreaProps) {
  const isLoading = fadeClass === 'fade-out' || !frase;

  return (
    <div className="motd-main" onClick={onClick}>
      <MotdStats stats={stats} />
      
      <div className={`motd-frase ${fadeClass}`}>
        {frase || 'Carregando sua dose de motivação...'}
      </div>
      
      <div className="motd-actions">
        <button 
          className={`motd-button primary ${isLoading ? 'loading' : ''}`} 
          onClick={(e) => {
            e.stopPropagation();
            onGenerateNew();
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="loading-spinner"></span>
              Gerando...
            </>
          ) : (
            'Nova frase'
          )}
        </button>
        
        <MotdActionButtons
          isFavorited={isFavorited}
          onToggleFavorite={onToggleFavorite}
          onCopy={onCopy}
          onShare={onShare}
        />
      </div>
      
      {aviso && (
        <div className="motd-aviso">{aviso}</div>
      )}
      
      <div className="keyboard-hints">
        <kbd>Espaço</kbd> Nova frase • <kbd>F</kbd> Favoritar • <kbd>C</kbd> Copiar • <kbd>S</kbd> Compartilhar
      </div>
    </div>
  );
}
