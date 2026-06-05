/**
 * Single source of truth for the social-media preview-crawler list.
 *
 * These are the bots that fetch a URL to build a link preview (the little
 * card you see when you paste a link into IG/X/Slack/WhatsApp). They:
 *   - announce themselves honestly in the User-Agent header
 *   - never run JavaScript, never click, never scroll
 *
 * We use this in two places:
 *   1. nginx members vhost — hard 403 (members.* must never be previewed)
 *   2. server/routes/fanvueRoutes.js — serve bots a neutral page instead of
 *      redirecting them to the creator's Fanvue (adult) profile.
 *
 * Keep this regex in sync with `.deploy/nginx-members.conf` (the `if
 * ($http_user_agent ~* (...))` block). Same names, same order, on purpose.
 */
const SOCIAL_BOT_RE =
  /facebookexternalhit|Twitterbot|TikTokBot|Instagram|meta-externalagent|LinkedInBot|Pinterest|Slackbot|WhatsApp|TelegramBot|Discordbot|SocialBot/i;

/** True if the request's User-Agent looks like a social-preview crawler. */
function isSocialBot(userAgent) {
  return SOCIAL_BOT_RE.test(String(userAgent || ''));
}

module.exports = { SOCIAL_BOT_RE, isSocialBot };
