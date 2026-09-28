const { logger } = require('../utils/logger');
const {
  findProfessionalById,
  isClinicProfessionalAccount,
} = require('../repositories/professionalRepository');
const {
  upsertConversationPreview,
  listOpenConversations,
  closeConversation,
} = require('../repositories/whatsappConversationRepository');
const {
  findChats,
  findContacts,
  resolveInstanceNameForProfessional,
} = require('../services/whatsappService');

function extractJid(row) {
  const raw =
    row?.remoteJid ||
    row?.id ||
    row?.jid ||
    row?.key?.remoteJid ||
    row?.chatId ||
    row?.remoteJidAlt ||
    null;
  if (!raw) return null;
  if (typeof raw === 'object') {
    const user = raw.user || '';
    const server = raw.server || '';
    if (user && server) return `${user}@${server}`;
    if (typeof raw._serialized === 'string') return raw._serialized;
    return null;
  }
  return String(raw);
}

function shouldSkipJid(jid) {
  const value = String(jid || '').toLowerCase();
  if (!value) return true;
  if (value.includes('status@broadcast')) return true;
  if (value.includes('@newsletter')) return true;
  if (value.endsWith('@broadcast')) return true;
  return false;
}

function isPhoneContactJid(jid) {
  const value = String(jid || '');
  if (!value.includes('@s.whatsapp.net')) return false;
  if (value.startsWith('0@')) return false;
  const digits = value.split('@')[0].replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

function conversationKeyFromJid(jid) {
  const value = String(jid || '').trim();
  if (!value) return null;
  if (value.includes('@g.us')) return value;
  if (value.includes('@lid')) return value;

  const user = value.split('@')[0].split(':')[0];
  const digits = user.replace(/\D/g, '');

  if (
    digits.length >= 10 &&
    digits.length <= 13 &&
    (value.includes('@s.whatsapp.net') || !value.includes('@'))
  ) {
    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  return value;
}

function extractPreview(chat) {
  const candidates = [
    chat?.lastMessage?.message?.conversation,
    chat?.lastMessage?.message?.extendedTextMessage?.text,
    chat?.lastMessage?.message?.imageMessage?.caption,
    chat?.lastMessage?.conversation,
    chat?.lastMessage?.body,
    chat?.lastMessage?.text,
  ];
  for (const c of candidates) {
    const text = String(c || '').trim();
    if (text) return text.slice(0, 120);
  }
  const msg = chat?.lastMessage?.message || chat?.lastMessage || {};
  if (msg.audioMessage || msg.pttMessage) return '[Áudio]';
  if (msg.imageMessage) return '[Imagem]';
  if (msg.videoMessage) return '[Vídeo]';
  if (msg.documentMessage) return '[Documento]';
  if (msg.stickerMessage) return '[Figurinha]';
  if (msg.contactMessage) return '[Contato]';
  return null;
}

function extractName(row, jid) {
  const name =
    row?.pushName ||
    row?.name ||
    row?.notify ||
    row?.verifiedName ||
    row?.contact?.pushName ||
    row?.subject ||
    null;
  if (name && String(name).trim()) return String(name).trim();
  if (String(jid || '').includes('@g.us')) return 'Grupo';
  if (String(jid || '') === '0@s.whatsapp.net') return 'WhatsApp Business';
  return null;
}

function extractUpdatedAt(row) {
  const raw =
    row?.updatedAt ||
    row?.conversationTimestamp ||
    row?.lastMessage?.messageTimestamp ||
    row?.createdAt ||
    null;
  if (!raw) return new Date().toISOString();
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    return new Date(ms).toISOString();
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Associa chat @lid ao contato com telefone real. */
function resolveLidToPhoneContact(chats, contacts) {
  const phoneContacts = contacts.filter((c) => isPhoneContactJid(extractJid(c)));
  if (phoneContacts.length === 0) return null;

  const chatPhoneJids = new Set(
    chats.map((c) => extractJid(c)).filter((j) => isPhoneContactJid(j))
  );
  const orphans = phoneContacts.filter((c) => !chatPhoneJids.has(extractJid(c)));
  if (orphans.length === 1) return orphans[0];
  if (phoneContacts.length === 1) return phoneContacts[0];
  return null;
}

function isGhostConversationKey(phone) {
  const value = String(phone || '');
  if (value.includes('@lid')) return true;
  if (/^\d+$/.test(value) && value.length > 13) return true;
  return false;
}

function preferReadableConversations(conversations) {
  return (conversations || []).filter((c) => !isGhostConversationKey(c.patient_phone));
}

async function upsertRow({ professionalId, jid, name, preview, lastMessageAt }) {
  const key = conversationKeyFromJid(jid);
  if (!key) return null;
  return upsertConversationPreview({
    professionalId,
    phone: key,
    patientName: name,
    preview,
    lastMessageAt,
    lastSenderType: 'patient',
  });
}

/**
 * Sincroniza chats + contatos da Evolution → whatsapp_conversations (clínica).
 */
async function syncConversationsFromEvolution(req, res) {
  const { professionalId } = req.params;
  if (!professionalId) {
    return res.status(400).json({ error: 'professionalId é obrigatório' });
  }

  try {
    const isClinic = await isClinicProfessionalAccount(professionalId);
    if (!isClinic) {
      return res.status(403).json({
        error: 'Sincronização de chats disponível apenas para contas clínica.',
      });
    }

    const professional = await findProfessionalById(professionalId);
    if (!professional) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }

    const instanceName = await resolveInstanceNameForProfessional(professional);
    if (!instanceName) {
      return res.status(422).json({ error: 'Instância WhatsApp não configurada' });
    }

    const [chats, contacts] = await Promise.all([
      findChats(instanceName),
      findContacts(instanceName),
    ]);

    let imported = 0;
    let skipped = 0;
    const importedKeys = new Set();
    const lidMapped = resolveLidToPhoneContact(chats, contacts);

    for (const chat of chats) {
      let jid = extractJid(chat);
      if (shouldSkipJid(jid)) {
        skipped += 1;
        continue;
      }

      let name = extractName(chat, jid);
      const preview = extractPreview(chat);
      const lastMessageAt = extractUpdatedAt(chat);

      if (String(jid).includes('@lid') && lidMapped) {
        jid = extractJid(lidMapped);
        name = extractName(lidMapped, jid) || name;
      }

      // Se ainda for LID sem mapeamento, pula (evita lixo na lista)
      if (String(jid).includes('@lid')) {
        skipped += 1;
        continue;
      }

      const key = conversationKeyFromJid(jid);
      const conv = await upsertRow({
        professionalId,
        jid,
        name,
        preview,
        lastMessageAt,
      });
      if (conv?.id) {
        imported += 1;
        if (key) importedKeys.add(key);
      } else skipped += 1;
    }

    for (const contact of contacts) {
      const jid = extractJid(contact);
      if (shouldSkipJid(jid)) continue;
      const key = conversationKeyFromJid(jid);
      if (!key || importedKeys.has(key)) continue;

      const conv = await upsertRow({
        professionalId,
        jid,
        name: extractName(contact, jid),
        preview: importedKeys.has(key) ? null : null,
        lastMessageAt: extractUpdatedAt(contact),
      });
      if (conv?.id) {
        imported += 1;
        importedKeys.add(key);
      }
    }

    // Encerra conversas fantasma (@lid / números inválidos) para não poluir a lista
    const allOpen = await listOpenConversations(professionalId);
    for (const conv of allOpen) {
      if (isGhostConversationKey(conv.patient_phone) && conv.id) {
        await closeConversation(conv.id);
      }
    }

    const conversations = preferReadableConversations(
      await listOpenConversations(professionalId)
    );

    logger.info('Sync Evolution → atendimento', {
      professionalId,
      instanceName,
      foundChats: chats.length,
      foundContacts: contacts.length,
      imported,
      skipped,
      open: conversations.length,
      lidMappedTo: lidMapped ? extractJid(lidMapped) : null,
    });

    return res.json({
      ok: true,
      found: chats.length + contacts.length,
      foundChats: chats.length,
      foundContacts: contacts.length,
      imported,
      skipped,
      conversations,
    });
  } catch (e) {
    logger.error('Erro ao sincronizar chats Evolution', e?.message || e);
    return res.status(500).json({
      error: e?.message || 'Erro ao sincronizar conversas do WhatsApp',
    });
  }
}

module.exports = { syncConversationsFromEvolution };
