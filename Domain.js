// require mongoose
const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');

const Schema = mongoose.Schema;
const ENCRYPTION_PREFIX = 'encv1';
const LEGACY_ENCRYPTION_PREFIX = 'enc:v1';

const getEncryptionKey = () => {
  const secret = process.env.DOMAIN_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
};

const encryptValue = value => {
  if (
    !value ||
    typeof value !== 'string' ||
    value.startsWith(`${ENCRYPTION_PREFIX}:`) ||
    value.startsWith(`${LEGACY_ENCRYPTION_PREFIX}:`)
  ) return value;

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return value;

  // 12-byte IV is recommended for AES-GCM mode.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptValue = value => {
  if (!value || typeof value !== 'string') return value;

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) return value;

  let parts;
  if (value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    parts = value.split(':');
    if (parts.length !== 4) return value;
  } else if (value.startsWith(`${LEGACY_ENCRYPTION_PREFIX}:`)) {
    parts = value.split(':');
    if (parts.length !== 5) return value;
  } else {
    return value;
  }

  const isLegacyEncrypted = parts.length === 5;

  try {
    const iv = Buffer.from(isLegacyEncrypted ? parts[2] : parts[1], 'base64');
    const authTag = Buffer.from(isLegacyEncrypted ? parts[3] : parts[2], 'base64');
    const encrypted = Buffer.from(isLegacyEncrypted ? parts[4] : parts[3], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.warn('Failed to decrypt a protected domain field');
    return value;
  }
};

const DomainSchema = new Schema({
  customers: [{
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer'
    },
    mailPreferences: {
      weeklyReport: {
        type: Boolean,
        default: true
      }
    },
    accessLevel: {
      type: String,
      default: 'creator',
      enum: ['creator', 'admin', 'member', 'viewer']
    }
  }],
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer'
  },
  company: {
    name: {
      type: String,
      required: true
    },
    website: {
      type: String,
      required: true
    }
  },
  apiKey: {
    type: String,
    required: true,
    set: encryptValue,
    get: decryptValue
  },
  customerDBName: {
    type: String,
    required: true
  },
  setup: {
    type: Boolean,
    default: false
  },
  integrations: {
    hubspot: {
      status: Boolean,
      accounts: [{
        hubId: String,
        hubDomain: String,
        accessToken: {
          type: String,
          set: encryptValue,
          get: decryptValue
        },
        refreshToken: {
          type: String,
          set: encryptValue,
          get: decryptValue
        },
        lastPulledDate: Date,
        lastPulledDates: {
          companies: {
            type: Date,
            default: moment().subtract(4, 'year').toISOString()
          },
          contacts: {
            type: Date,
            default: moment().subtract(4, 'year').toISOString()
          },
          deals: {
            type: Date,
            default: moment().subtract(4, 'year').toISOString()
          },
          meetings: {
            type: Date,
            default: moment().subtract(4, 'year').toISOString()
          }
        }
      }]
    }
  }
}, {
  minimize: false,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('Domain', DomainSchema);
