import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import FacebookStrategy from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import User from '../models/user.model.js';
import { generateToken } from '../utils/auth.js';

class OAuthService {
  constructor() {
    this.initializeStrategies();
  }

  initializeStrategies() {
    // Google Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use(new GoogleStrategy.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/v1/auth/google/callback'
      }, this.handleOAuthCallback.bind(this)));
    }

    // Facebook Strategy
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
      passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: '/api/v1/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'picture.type(large)']
      }, this.handleOAuthCallback.bind(this)));
    }

    // Twitter Strategy
    if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
      passport.use(new TwitterStrategy({
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: '/api/v1/auth/twitter/callback',
        includeEmail: true
      }, this.handleOAuthCallback.bind(this)));
    }
  }

  async handleOAuthCallback(accessToken, refreshToken, profile, done) {
    try {
      // Get email from profile
      const email = this.getEmailFromProfile(profile);
      if (!email) {
        return done(new Error('No email found in profile'));
      }

      // Check if user exists
      let user = await User.findOne({ email });

      if (!user) {
        // Create new user
        user = await User.create({
          email,
          name: this.getNameFromProfile(profile),
          password: this.generateRandomPassword(),
          isEmailVerified: true,
          oauthProvider: profile.provider,
          oauthId: profile.id,
          profilePicture: this.getProfilePictureFromProfile(profile)
        });
      } else if (!user.oauthProvider) {
        // Link existing account with OAuth
        user.oauthProvider = profile.provider;
        user.oauthId = profile.id;
        user.isEmailVerified = true;
        if (!user.profilePicture) {
          user.profilePicture = this.getProfilePictureFromProfile(profile);
        }
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }

  getEmailFromProfile(profile) {
    switch (profile.provider) {
      case 'google':
        return profile.emails[0].value;
      case 'facebook':
        return profile.emails[0].value;
      case 'twitter':
        return profile.emails[0].value;
      default:
        return null;
    }
  }

  getNameFromProfile(profile) {
    switch (profile.provider) {
      case 'google':
        return `${profile.name.givenName} ${profile.name.familyName}`;
      case 'facebook':
        return `${profile.name.givenName} ${profile.name.familyName}`;
      case 'twitter':
        return profile.displayName;
      default:
        return 'User';
    }
  }

  getProfilePictureFromProfile(profile) {
    switch (profile.provider) {
      case 'google':
        return profile.photos[0].value;
      case 'facebook':
        return profile.photos[0].value;
      case 'twitter':
        return profile.photos[0].value;
      default:
        return null;
    }
  }

  generateRandomPassword() {
    return Math.random().toString(36).slice(-8);
  }

  handleOAuthSuccess(req, res) {
    const token = generateToken(req.user);
    
    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);
  }

  handleOAuthFailure(req, res) {
    // Redirect to frontend with error
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
}

export default new OAuthService(); 