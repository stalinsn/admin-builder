import React, { useState } from "react";

type HeaderContactsProps = {
  phone: string;
  email: string;
  linkedin: string;
};

export default function HeaderContacts({ phone, email, linkedin }: HeaderContactsProps) {
  const [showPhone, setShowPhone] = useState(false);
  const phoneIntl = phone.startsWith("+") ? phone : `+55 ${phone}`;

  return (
    <p className="text-sm">
      {!showPhone ? (
        <button
          onClick={() => setShowPhone(true)}
          className="contact-linkedin"
          aria-label="Mostrar telefone"
        >
          Mostrar telefone
        </button>
      ) : (
        <button
          onClick={() => setShowPhone(false)}
          className="contact-linkedin contact-phone-btn"
          aria-label="Ocultar telefone"
        >
          {phoneIntl}
        </button>
      )}
      {' · '}
      <span className="contact-info contact-email">{email}</span> ·{' '}
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="contact-linkedin">
        LinkedIn
      </a>
    </p>
  );
}
