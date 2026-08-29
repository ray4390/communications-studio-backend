export const SERVICE_NAME = 'communications-studio-api';

export function publicServiceStatus({ guildId, warnings = [] } = {}) {
  return {
    ok: true,
    service: SERVICE_NAME,
    guild_id: guildId,
    config_warnings: warnings
  };
}
