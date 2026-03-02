# Monde Launch Checklist

## Pre-Submission

### App Store Requirements
- [ ] App icon (1024x1024 PNG, no alpha) in `assets/icon.png`
- [ ] Splash screen asset in `assets/splash.png`
- [ ] Adaptive icon for Android in `assets/adaptive-icon.png`
- [ ] App screenshots (6.7", 6.5", 5.5" for iOS; phone + tablet for Android)
- [ ] App description, keywords, and category prepared
- [ ] Privacy policy URL hosted (link in Terms screen)
- [ ] Support URL / contact email configured

### Configuration
- [ ] Update `app.json` version to release version
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` to production Supabase project
- [ ] Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to production anon key
- [ ] Configure `eas.json` iOS submit credentials (Apple ID, Team ID, ASC App ID)
- [ ] Configure `eas.json` Android submit credentials (Google Play service account JSON)
- [ ] Set `EXPO_TOKEN` secret in GitHub repository for CI/CD
- [ ] Remove or disable demo/placeholder data in store

### Security
- [ ] Address HIGH priority items from `SECURITY_AUDIT.md`
- [ ] Add rate limiting on PIN attempts (server-side)
- [ ] Add global transaction amount CHECK constraint in DB
- [ ] Verify all RLS policies via Supabase Advisors
- [ ] Rotate Supabase anon key if it was exposed during development

### Testing
- [ ] Run `npm test` — all unit tests pass
- [ ] Manual test: registration flow end-to-end
- [ ] Manual test: send payment via QR
- [ ] Manual test: top-up and withdraw
- [ ] Manual test: linked accounts CRUD
- [ ] Manual test: dark mode toggle
- [ ] Manual test: onboarding flow (first launch)
- [ ] Test on physical iOS device
- [ ] Test on physical Android device

## Submission Commands

### Google Play (Internal Testing)
```bash
# Build production AAB
eas build --platform android --profile production

# Submit to Google Play internal track
eas submit --platform android --profile production
```

### Apple TestFlight
```bash
# Build production IPA
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production
```

### OTA Update (post-launch)
```bash
# Push update without new binary
eas update --branch production --message "v1.0.1 - bug fixes"
```

## Post-Launch
- [ ] Monitor Sentry for crash reports (after enabling)
- [ ] Monitor Mixpanel for user engagement (after enabling)
- [ ] Set up Supabase alerts for database issues
- [ ] Plan v1.1 features based on user feedback
