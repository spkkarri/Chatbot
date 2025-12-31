# server/rag_service/bias_wordlists.py

"""
This file contains dictionaries of terms for the fast, initial check
in the hybrid bias detection system. It's designed to be easily editable
by an administrator to add or change terms specific to their institution's style guide.
"""

# This list focuses on terms that are often non-inclusive or have more
# objective, modern alternatives.
INCLUSIVE_LANGUAGE_REPLACEMENTS = {
    # Gendered Terms
    "mankind": "humanity / people",
    "man-made": "synthetic / artificial / human-made",
    "forefathers": "ancestors / forebears / founders",
    "chairman": "chair / chairperson",
    "policeman": "police officer",
    "housewife": "homemaker / stay-at-home parent",
    "manpower": "workforce / staff / personnel",

    # Ableist Language
    "lame": "uninspiring / disappointing",
    "crazy": "intense / wild / chaotic",
    "insane": "unbelievable / shocking",
    "blind review": "anonymized review",
    "tone deaf": "insensitive / out of touch",

    # Other potentially problematic terms
    "whitelist": "allowlist / permitted list",
    "blacklist": "denylist / blocklist",
    "master/slave": "primary/replica or primary/secondary",
    "sanity check": "quick check / confirmation check",
}

# This can be expanded with other categories in the future.
# For example, culturally specific terms or jargon to avoid.