import React from 'react';

type ActionButtonsProps = {
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onCopy: () => void;
  onShare: () => void;
};

export default function MotdActionButtons({ 
  isFavorited, 
  onToggleFavorite, 
  onCopy, 
  onShare 
}: ActionButtonsProps) {
  return (
    <div 
      className="action-buttons"
      onClick={(e) => e.stopPropagation()} // Prevent click from bubbling up
    >
      <button 
        className={`action-btn ${isFavorited ? 'favorited' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        {isFavorited ? '❤️' : '🤍'}
      </button>
      
      <button 
        className="action-btn"
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        title="Copiar frase para área de transferência"
      >
        📋
      </button>
      
      <button 
        className="action-btn"
        onClick={(e) => {
          e.stopPropagation();
          onShare();
        }}
        title="Compartilhar frase (ou copiar se não suportado)"
      >
        📤
      </button>
    </div>
  );
}
