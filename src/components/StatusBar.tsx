'use client';

import React, { useState, useRef, useEffect } from 'react';
import StatusBarContainer from './StatusBarContainer';
import StatusBarHeader from './StatusBarHeader';
import StatusBarDetails from './StatusBarDetails';
import '@/styles/statusbar.css';
import '@/styles/components/status-bar.css';

interface StatusBarProps {
  loading: boolean;
  statusMessage: string;
  tokensUsed: number | null;
  elapsedTime: number | null;
  payloadSize: number | null;
  charCount: number | null;
  model: string;
  usosRestantes?: number | null;
}

export default function StatusBar({
  loading,
  statusMessage,
  tokensUsed,
  elapsedTime,
  payloadSize,
  charCount,
  model,
  usosRestantes,
}: StatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState({ top: 16, left: 16 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement>(null);

  // Drag preciso e suave: atualiza o estilo diretamente durante o drag
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (dragging && barRef.current) {
        const left = Math.max(0, e.clientX - dragOffset.current.x);
        const top = Math.max(0, e.clientY - dragOffset.current.y);
        barRef.current.style.left = left + 'px';
        barRef.current.style.top = top + 'px';
      }
    }
    function handleMouseUp(e: MouseEvent) {
      if (dragging && barRef.current) {
        const left = Math.max(0, e.clientX - dragOffset.current.x);
        const top = Math.max(0, e.clientY - dragOffset.current.y);
        setPosition({ left, top }); // só atualiza o estado ao soltar
      }
      setDragging(false);
      document.body.style.userSelect = '';
    }
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // Sempre mostra se loading, senão respeita o visible
  const shouldShow = loading || (statusMessage && visible);
  if (!shouldShow) return null;

  const dolar = 5.2; // Base de conversão manual
  const costUSD = tokensUsed ? (tokensUsed / 1000) * 0.002 : 0;
  const costBRL = costUSD * dolar;
  const speed =
    tokensUsed && elapsedTime ? (tokensUsed / elapsedTime).toFixed(2) : null;
  const requisicoesPorDolar =
    costUSD > 0 ? (1 / costUSD).toFixed(0) : '∞';

  return (
    <StatusBarContainer
      position={position}
      dragging={dragging}
      barRef={barRef as React.RefObject<HTMLDivElement>}
      expanded={expanded}
    >
      <div
        className="statusbar-header"
        onMouseDown={onMouseDown}
        style={!expanded ? { cursor: 'default', userSelect: 'auto' } : {}}
      >
        <StatusBarHeader
          statusMessage={statusMessage}
          usosRestantes={usosRestantes}
          expanded={expanded}
          setVisible={setVisible}
          setExpanded={setExpanded}
        />
      </div>
      {expanded && (
        <StatusBarDetails
          tokensUsed={tokensUsed}
          elapsedTime={elapsedTime}
          payloadSize={payloadSize}
          charCount={charCount}
          model={model}
          costUSD={costUSD}
          costBRL={costBRL}
          speed={speed}
          requisicoesPorDolar={requisicoesPorDolar}
        />
      )}
    </StatusBarContainer>
  );
}
