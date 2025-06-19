import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import FacebookStrategy from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import User from '../models/user.model.js';
import { generateTokenPair } from '../utils/auth.js';
import RefreshToken from '../models/refreshToken.model.js';

class OAuthService {
  constructor() {
    this.initializeStrategies();
    this.initializePassport();
  }

  initializePassport() {
    // Serialize user
    passport.serializeUser((user, done) => {
      console.log('Serializing user:', user);
      if (!user) {
        return done(new Error('No user to serialize'));
      }
      // Handle both user object and user._id
      const userId = user._id || user.id;
      if (!userId) {
        return done(new Error('No user ID found'));
      }
      done(null, userId);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
      try {
        console.log('Deserializing user ID:', id);
        const user = await User.findById(id);
        if (!user) {
          return done(new Error('User not found'));
        }
        done(null, user);
      } catch (error) {
        console.error('Deserialization error:', error);
        done(error, null);
      }
    });
  }

  initializeStrategies() {
    // Google Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use(new GoogleStrategy.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:9600/api/v1/auth/google/callback'
      }, this.handleOAuthCallback.bind(this)));
    }

    // Facebook Strategy
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
      passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: 'http://localhost:9600/api/v1/auth/facebook/callback',
        profileFields: ['id', 'emails', 'name', 'picture.type(large)']
      }, this.handleOAuthCallback.bind(this)));
    }

    // Twitter Strategy
    if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
      passport.use(new TwitterStrategy({
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: 'http://localhost:9600/api/v1/auth/twitter/callback',
        includeEmail: true
      }, this.handleOAuthCallback.bind(this)));
    }
  }

  async handleOAuthCallback(accessToken, refreshToken, profile, done) {
    try {
      console.log('OAuth Callback - Profile:', profile);
      
      // Get email from profile
      const email = this.getEmailFromProfile(profile);
      if (!email) {
        console.log('No email found in profile');
        return done(new Error('No email found in profile'));
      }

      // Check if user exists
      let user = await User.findOne({ email });
      console.log('Existing user:', user);

      if (!user) {
        // Generate unique username
        const baseUsername = email.split('@')[0];
        let username = baseUsername;
        let counter = 1;
        
        while (await User.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
        
        console.log('Creating new user with username:', username);
        
        user = await User.create({
          email,
          username,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          password: this.generateRandomPassword(),
          isEmailVerified: true,
          oauthProvider: profile.provider,
          oauthId: profile.id,
          profilePicture: this.getProfilePictureFromProfile(profile)
        });
        console.log('New user created:', user);
      }

      // Convert user to plain object if it's a Mongoose document
      const userObj = user.toObject ? user.toObject() : user;
      
      // Log the user object before passing to done
      console.log('User object being passed to done:', userObj);
      
      return done(null, userObj);
    } catch (error) {
      console.error('OAuth Callback Error:', error);
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

  async handleOAuthSuccess(req, res) {
    try {
      console.log('OAuth Success - User:', req.user);
      
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication failed' });
      }

      // Generate token pair
      const tokens = generateTokenPair(req.user);

      // Store refresh token
      const refreshToken = await RefreshToken.create({
        token: tokens.refreshToken,
        user: req.user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL}/auth/success`);
    } catch (error) {
      console.error('OAuth Success Error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }
  }

  handleOAuthFailure(req, res) {
    // Redirect to frontend with error
    res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
}

export default new OAuthService(); 