export type RecipientRole = 'contact' | 'team' | 'external';

export type NotificationRecipient = {
  email: string;
  name: string;
  type: RecipientRole;
  id: string | null;
  is_primary?: boolean;
};

export const isSalutationEligible = (r: NotificationRecipient) =>
  r.type === 'contact' || r.type === 'external';

export const ensurePrimaryRecipient = (recipients: NotificationRecipient[]): NotificationRecipient[] => {
  if (recipients.length === 0) return recipients;

  const eligible = recipients.filter(isSalutationEligible);
  if (eligible.length === 0) {
    return recipients.map((r) => ({ ...r, is_primary: false }));
  }

  const flagged = recipients.find((r) => r.is_primary && isSalutationEligible(r));
  if (flagged) {
    return recipients.map((r) => ({
      ...r,
      is_primary: isSalutationEligible(r) && r.email === flagged.email,
    }));
  }

  let assigned = false;
  return recipients.map((r) => {
    if (!assigned && isSalutationEligible(r)) {
      assigned = true;
      return { ...r, is_primary: true };
    }
    return { ...r, is_primary: false };
  });
};

export const setPrimaryRecipient = (
  recipients: NotificationRecipient[],
  email: string
): NotificationRecipient[] =>
  recipients.map((r) => ({
    ...r,
    is_primary: r.email === email && isSalutationEligible(r),
  }));

export const onToggleRecipient = (
  prev: NotificationRecipient[],
  recipient: NotificationRecipient
): NotificationRecipient[] => {
  const exists = prev.find((r) => r.email === recipient.email);
  if (exists) {
    return ensurePrimaryRecipient(prev.filter((r) => r.email !== recipient.email));
  }
  return ensurePrimaryRecipient([...prev, { ...recipient, is_primary: false }]);
};

export const normalizeLoadedRecipients = (raw: unknown[]): NotificationRecipient[] => {
  const parsed: NotificationRecipient[] = raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const rec = item as Record<string, unknown>;
      const email = String(rec.email || '').trim();
      const name = String(rec.name || email || 'Destinatario').trim();
      const type: RecipientRole =
        rec.type === 'team' ? 'team' : rec.type === 'contact' ? 'contact' : 'external';
      return {
        email,
        name,
        type,
        id: rec.id != null ? String(rec.id) : null,
        is_primary: !!rec.is_primary,
      };
    })
    .filter((r) => r.email);

  return ensurePrimaryRecipient(parsed);
};

export const validateRecipientsForSend = (recipients: NotificationRecipient[]): string | null => {
  if (recipients.length === 0) return 'Selecciona al menos un destinatario.';
  if (!recipients.some(isSalutationEligible)) {
    return 'Debes incluir al menos un contacto del cliente para el saludo del correo.';
  }
  if (!recipients.some((r) => r.is_primary && isSalutationEligible(r))) {
    return 'Selecciona quién recibirá el saludo "Estimado(a)..." del correo.';
  }
  return null;
};
