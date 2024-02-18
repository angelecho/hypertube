import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { Profile } from 'passport-google-oauth20';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.userService.findOneByUsername(username);

    if (!user) return null;

    const result = await bcrypt.compare(password, user.password);
    if (result) {
      const { password, ...rest } = user;
      return rest;
    }
    return null;
  }

  async validateGoogleUser(profile: Profile) {
    const { name, emails, photos, displayName } = profile;
    const email = emails.filter((e) => e.verified)[0]?.value;

    if (!email) return null;
    const user = await this.userService.findOneByEmail(email);

    if (!user) {
      const newUser = await this.userService.create({
        firstName: name.givenName,
        lastName: name.familyName,
        username: displayName,
        email,
        image: photos[0].value,
        provider: 'google',
        password: new Date().toString().slice(10, 30),
      });
      return newUser;
    }

    return null;
  }

  getCookieWithJwtAccessToken(userId: string) {
    const payload = { userId };
    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: `${this.getExpirationAccess()}s`,
    });

    return {
      accessToken: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * this.getExpirationAccess()),
    };
  }
  getCookieWithJwtRefreshToken(userId: string) {
    const payload = { userId };
    const expiration = this.getExpirationRefresh();
    const token = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: expiration,
    });
    return {
      refreshToken: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * expiration),
    };
  }

  getVerifyEmailToken(userId: string) {
    const expiration = this.getExpirationAccess();
    return this.jwtService.sign(
      { userId },
      {
        secret: process.env.JWT_VERIFICATION_SECRET,
        expiresIn: `${expiration}s`,
      },
    );
  }

  private getExpirationAccess() {
    return parseInt(process.env.JWT_ACCESS_DURATION) * 60;
  }
  private getExpirationRefresh() {
    return parseInt(process.env.JWT_REFRESH_DURATION) * 60;
  }
}
