const { normalizePhone } = require('./conversationStateStore');

/** Gera variantes com/sem DDI 55 para comparar telefones do WhatsApp e do cadastro. */
function phoneLookupVariants(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return [];

  const variants = new Set([digits]);

  if (digits.startsWith('55') && digits.length >= 12) {
    variants.add(digits.slice(2));
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    variants.add(`55${digits}`);
  }

  return Array.from(variants);
}

function phonesMatch(a, b) {
  const va = phoneLookupVariants(a);
  const vb = phoneLookupVariants(b);
  if (!va.length || !vb.length) return false;
  return va.some((x) => vb.includes(x));
}

module.exports = {
  phoneLookupVariants,
  phonesMatch,
};
