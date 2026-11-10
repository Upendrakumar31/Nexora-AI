/**
 * Determines whether an API error represents a genuine subscription entitlement failure.
 * Returns true ONLY if the error indicates that the user lacks an active Pro subscription
 * or has reached their plan quota. Returns false for upstream/technical errors (e.g. 502,
 * Cloudinary permission errors, network issues, 500s).
 *
 * @param {any} error - Axios error object, error payload, or error message string
 * @param {number} [statusCode] - Optional explicit HTTP status code
 * @returns {boolean}
 */
export function isSubscriptionEntitlementError(error, statusCode) {
    if (!error) return false;

    const message = typeof error === 'string'
        ? error
        : (error.response?.data?.message || error.message || '');

    const status = statusCode || error.response?.status;
    const lower = String(message).toLowerCase();

    // Technical or upstream service failures must NEVER open checkout
    if (
        lower.includes('cloudinary') ||
        lower.includes('storage') ||
        lower.includes('upstream') ||
        lower.includes('service error') ||
        lower.includes('service unavailable') ||
        lower.includes('unexpected status code') ||
        lower.includes('missing permissions') ||
        lower.includes('bad gateway') ||
        status === 502 ||
        status === 503 ||
        status === 504
    ) {
        return false;
    }

    // Explicit messages indicating plan or entitlement requirements
    const isEntitlementMessage =
        lower.includes('premium subscription') ||
        lower.includes('only available for premium') ||
        lower.includes('upgrade to nexora pro') ||
        lower.includes('upgrade to pro') ||
        lower.includes('free tier limit reached') ||
        (lower.includes('upgrade') && lower.includes('plan'));

    if (isEntitlementMessage) {
        return true;
    }

    // For HTTP 403, require explicit confirmation of plan/subscription failure
    if (status === 403 && (lower.includes('subscription') || lower.includes('premium') || lower.includes('plan') || lower.includes('upgrade'))) {
        return true;
    }

    return false;
}
