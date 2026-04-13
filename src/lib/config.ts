export const adminConfig = {
  password: process.env.ADMIN_PASSWORD, // In a real app this should only be in env
  cookieName: 'horizon_session',
  cookieDuration: 60 * 60 * 24 * 7, // 1 week
};
