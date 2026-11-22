import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { SKIP_AUTH_RETRY } from '../interceptors/auth-request-context';
import type { LoginResponse, User } from '../models/user.model';
import { AuthService, AuthSessionChangedError } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { RequestCacheService } from './request-cache.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const BASE = environment.apiUrl;
const USER_KEY = environment.storageKeys.user;
const user = (id:number):User => ({id,nombre:`User ${id}`,aPaterno:'QA',aMaterno:'',email:`user${id}@example.test`,telefono:'7710000000',rol:1,activo:1});
function session(id:number,sessionId=`session-${id}`,marker='initial'):LoginResponse {
  const payload={id_usuario:id,nombre:`User ${id}`,email:user(id).email,rol:1,sessionId,exp:Math.floor(Date.now()/1000)+3600,marker};
  const encode=(value:unknown)=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return {accessToken:`${encode({alg:'HS256'})}.${encode(payload)}.qa-signature`,refreshToken:`refresh-${id}-${marker}`,sessionId,accessTokenExpiresIn:'15m',refreshTokenExpiresIn:'7d'};
}

describe('AuthService and active authInterceptor: session lifecycle',()=>{
  let auth:AuthService;
  let http:HttpTestingController;
  let tokens:TokenService;
  let client:HttpClient;
  let navigate:jasmine.Spy;
  let toast:{success:jasmine.Spy;error:jasmine.Spy};
  let clock:{startInactivityCountdown:jasmine.Spy;clearFailedAttempts:jasmine.Spy;clearSession:jasmine.Spy;checkAccountLock:jasmine.Spy;getRemainingLockTime:jasmine.Spy;recordFailedAttempt:jasmine.Spy;lockAccount:jasmine.Spy;getFailedAttempts:jasmine.Spy;isActive:()=>boolean;remainingTime:()=>number;isAccountLocked:()=>boolean};
  let cache:{clear:jasmine.Spy};

  beforeEach(()=>{
    for(const key of [USER_KEY,'auth_timestamp','auth:access_token','auth:refresh_token','auth:session_id','sc_remember_email','sc_remember_me','qa_public_preference']){
      localStorage.removeItem(key);sessionStorage.removeItem(key);
    }
    navigate=jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
    toast={success:jasmine.createSpy('success'),error:jasmine.createSpy('error')};
    clock={startInactivityCountdown:jasmine.createSpy(),clearFailedAttempts:jasmine.createSpy(),clearSession:jasmine.createSpy(),checkAccountLock:jasmine.createSpy().and.returnValue(false),getRemainingLockTime:jasmine.createSpy().and.returnValue(0),recordFailedAttempt:jasmine.createSpy(),lockAccount:jasmine.createSpy(),getFailedAttempts:jasmine.createSpy().and.returnValue(1),isActive:()=>true,remainingTime:()=>1000,isAccountLocked:()=>false};
    cache={clear:jasmine.createSpy('clear')};
    TestBed.configureTestingModule({providers:[
      provideHttpClient(withInterceptors([authInterceptor])),provideHttpClientTesting(),
      {provide:Router,useValue:{url:'/',parseUrl:()=>({queryParams:{}}),navigate,navigateByUrl:navigate}},
      {provide:ToastrService,useValue:toast},{provide:SessionService,useValue:clock},{provide:RequestCacheService,useValue:cache},
    ]});
  });
  afterEach(()=>{
    http?.verify({ignoreCancelled:true});
    TestBed.resetTestingModule();
  });
  function init(pendingRestore=false):TestRequest {
    auth=TestBed.inject(AuthService);http=TestBed.inject(HttpTestingController);tokens=TestBed.inject(TokenService);client=TestBed.inject(HttpClient);
    const restore=http.expectOne(`${BASE}/users/session`);
    if(!pendingRestore)restore.flush({}, {status:401,statusText:'Unauthorized'});
    return restore;
  }
  function signedIn(id=1,sid=`session-${id}`):void {
    auth.handleAuthenticationResponse(session(id,sid),{navigate:false});
    navigate.calls.reset();toast.success.calls.reset();toast.error.calls.reset();clock.recordFailedAttempt.calls.reset();
  }

  it('restores a cookie session normally without circular interceptor injection or navigation',()=>{
    const restore=init(true);restore.flush(session(1));
    expect(auth.currentUser()?.id).toBe(1);expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.isCurrentSession(auth.captureSession())).toBeTrue();expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels an outstanding cookie restoration when the local session is cleared',()=>{
    const restore=init(true);auth.clearAuthState(false);
    expect(restore.cancelled).toBeTrue();expect(auth.currentUser()).toBeNull();expect(tokens.getAccessToken()).toBeNull();
  });

  it('a new login invalidates cookie restoration and does not inherit another account profile',()=>{
    const restore=init(true);signedIn(2);
    expect(restore.cancelled).toBeTrue();expect(auth.currentUser()?.id).toBe(2);expect(auth.currentUser()?.aPaterno).toBe('');
  });

  it('clears only the deleted session and its matching remembered email, preserving public preferences',()=>{
    init();signedIn();const owner=auth.captureSession()!;
    localStorage.setItem('sc_remember_email',user(1).email.toUpperCase());localStorage.setItem('sc_remember_me','true');localStorage.setItem('qa_public_preference','keep');
    auth.clearDeletedAccountSession(owner);
    expect(auth.currentUser()).toBeNull();expect(tokens.getRefreshToken()).toBeNull();expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(localStorage.getItem('sc_remember_email')).toBeNull();expect(localStorage.getItem('qa_public_preference')).toBe('keep');
    expect(navigate).not.toHaveBeenCalled();http.expectNone(`${BASE}/users/logout`);
  });

  it('does not clear another account or its preferences after an old deletion response',()=>{
    init();signedIn(1);const owner=auth.captureSession()!;signedIn(2);const tokenB=tokens.getAccessToken();localStorage.setItem('sc_remember_email',user(2).email);
    auth.clearDeletedAccountSession(owner);
    expect(auth.currentUser()?.id).toBe(2);expect(tokens.getAccessToken()).toBe(tokenB);expect(localStorage.getItem('sc_remember_email')).toBe(user(2).email);
  });

  it('does not clear a newer session of the same account',()=>{
    init();signedIn(1);const owner=auth.captureSession()!;signedIn(1,'new-session');auth.clearDeletedAccountSession(owner);
    expect(auth.currentUser()?.id).toBe(1);expect(tokens.getSessionId()).toBe('new-session');
  });

  it('preserves a remembered email belonging to another account during deletion',()=>{
    init();signedIn(1);localStorage.setItem('sc_remember_email',user(2).email);auth.clearDeletedAccountSession(auth.captureSession()!);
    expect(localStorage.getItem('sc_remember_email')).toBe(user(2).email);
  });

  it('refresh is shared normally and an old replay cannot provide a token after clearing',()=>{
    init();signedIn();const refresh=auth.refreshAccessToken();const values:string[]=[];
    refresh.subscribe(value=>values.push(value));auth.refreshAccessToken().subscribe(value=>values.push(value));
    const renewed=session(1,'session-1','renewed');http.expectOne(`${BASE}/users/refresh-token`).flush(renewed);
    expect(values).toEqual([renewed.accessToken,renewed.accessToken]);expect(tokens.getAccessToken()).toBe(renewed.accessToken);
    auth.clearAuthState(false);let stale:unknown;refresh.subscribe({error:error=>stale=error});expect(stale instanceof AuthSessionChangedError).toBeTrue();
  });

  it('ignores a refresh response from account A after switching to account B',()=>{
    init();signedIn(1);let error:unknown;auth.refreshAccessToken().subscribe({error:value=>error=value});const old=http.expectOne(`${BASE}/users/refresh-token`);
    auth.clearAuthState(false);signedIn(2);old.flush(session(1,'session-1','late'));
    expect(error instanceof AuthSessionChangedError).toBeTrue();expect(auth.currentUser()?.id).toBe(2);expect(tokens.getSessionId()).toBe('session-2');expect(navigate).not.toHaveBeenCalled();
  });

  it('an old refresh finalizer cannot erase the refresh currently pending for account B',()=>{
    init();signedIn(1);auth.refreshAccessToken().subscribe({error:()=>undefined});const old=http.expectOne(`${BASE}/users/refresh-token`);
    auth.clearAuthState(false);signedIn(2);const current=auth.refreshAccessToken();current.subscribe();const next=http.expectOne(`${BASE}/users/refresh-token`);
    old.flush({}, {status:401,statusText:'Unauthorized'});expect(auth.refreshAccessToken()).toBe(current);
    next.flush(session(2,'session-2','renewed'));expect(auth.currentUser()?.id).toBe(2);
  });

  it('does not persist a delayed profile response into another account',()=>{
    init();signedIn(1);let error:unknown;auth.updateProfile({nombre:'Old update'}).subscribe({error:value=>error=value});const pending=http.expectOne(`${BASE}/users/update-profile`);
    signedIn(2);pending.flush({message:'Updated',user:{...user(1),nombre:'Old update'}});
    expect(error instanceof AuthSessionChangedError).toBeTrue();expect(auth.currentUser()?.nombre).toBe('User 2');expect(auth.currentUser()?.id).toBe(2);
  });

  it('does not send a profile edit captured for A if subscribed after B signs in',()=>{
    init();signedIn(1);const pending=auth.updateProfile({nombre:'Old update'});signedIn(2);let error:unknown;pending.subscribe({error:value=>error=value});
    expect(error instanceof AuthSessionChangedError).toBeTrue();http.expectNone(`${BASE}/users/update-profile`);
  });

  it('keeps normal profile updates and removes an earlier remembered email of the same account on deletion',()=>{
    init();signedIn(1);localStorage.setItem('sc_remember_email',user(1).email);
    auth.updateProfile({email:'new@example.test'}).subscribe();http.expectOne(`${BASE}/users/update-profile`).flush({message:'Updated',user:{...user(1),email:'new@example.test'}});
    expect(auth.currentUser()?.email).toBe('new@example.test');auth.clearDeletedAccountSession(auth.captureSession()!);expect(localStorage.getItem('sc_remember_email')).toBeNull();
  });

  it('only the newest pending login can become the current account',()=>{
    init();let oldError:unknown;auth.login({email:user(1).email,passw:'synthetic-password'}).subscribe({error:value=>oldError=value});const old=http.expectOne(`${BASE}/users/login-user`);
    auth.login({email:user(2).email,passw:'synthetic-password'}).subscribe();http.expectOne(`${BASE}/users/login-user`).flush(session(2));
    old.flush(session(1));expect(oldError instanceof AuthSessionChangedError).toBeTrue();expect(auth.currentUser()?.id).toBe(2);expect(clock.recordFailedAttempt).not.toHaveBeenCalled();expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('clearing a session also invalidates an already pending login',()=>{
    init();auth.login({email:user(1).email,passw:'synthetic-password'}).subscribe({error:()=>undefined});const old=http.expectOne(`${BASE}/users/login-user`);auth.clearAuthState(false);old.flush(session(1));
    expect(auth.currentUser()).toBeNull();expect(tokens.getAccessToken()).toBeNull();expect(toast.success).not.toHaveBeenCalled();
  });

  it('a late failed login does not toast, count failures or navigate after B signs in',()=>{
    init();auth.login({email:user(1).email,passw:'synthetic-password'}).subscribe({error:()=>undefined});const old=http.expectOne(`${BASE}/users/login-user`);signedIn(2);old.flush({}, {status:401,statusText:'Unauthorized'});
    expect(auth.currentUser()?.id).toBe(2);expect(clock.recordFailedAttempt).not.toHaveBeenCalled();expect(toast.error).not.toHaveBeenCalled();expect(navigate).not.toHaveBeenCalled();
  });

  it('normal failed login still records its attempt and shows its message',()=>{
    init();auth.login({email:user(1).email,passw:'synthetic-password'}).subscribe({error:()=>undefined});http.expectOne(`${BASE}/users/login-user`).flush({message:'Invalid credentials'},{status:401,statusText:'Unauthorized'});
    expect(clock.recordFailedAttempt).toHaveBeenCalledWith(user(1).email);expect(toast.error).toHaveBeenCalled();
  });

  it('a late logout response cannot clear or redirect a new account',()=>{
    init();signedIn(1);auth.logout();const old=http.expectOne(`${BASE}/users/logout`);expect(auth.currentUser()).toBeNull();signedIn(2);old.flush({message:'Logged out'});
    expect(auth.currentUser()?.id).toBe(2);expect(navigate).not.toHaveBeenCalled();expect(toast.success).not.toHaveBeenCalled();
  });

  it('normal logout clears immediately and navigates after its server response',()=>{
    init();signedIn(1);auth.logout();expect(auth.currentUser()).toBeNull();http.expectOne(`${BASE}/users/logout`).flush({message:'Logged out'});
    expect(navigate).toHaveBeenCalledWith(['/home']);expect(toast.success).toHaveBeenCalled();
  });

  it('resynchronizes TokenService from a different tab and invalidates its old snapshot',()=>{
    init();signedIn(1);const before=auth.captureSession()!;const second=session(2);
    localStorage.setItem(USER_KEY,JSON.stringify(user(2)));localStorage.setItem('auth:access_token',second.accessToken);localStorage.setItem('auth:refresh_token',second.refreshToken);localStorage.setItem('auth:session_id',second.sessionId);
    window.dispatchEvent(new StorageEvent('storage',{key:USER_KEY,storageArea:localStorage}));
    expect(auth.currentUser()?.id).toBe(2);expect(tokens.getSessionId()).toBe('session-2');expect(tokens.getAccessToken()).toBe(second.accessToken);expect(auth.isCurrentSession(before)).toBeFalse();
  });

  it('detects another tab taking ownership even before its storage event is delivered',()=>{
    init();signedIn(1);const owner=auth.captureSession()!;localStorage.setItem(USER_KEY,JSON.stringify(user(2)));localStorage.setItem('auth:session_id','session-2');auth.clearDeletedAccountSession(owner);
    expect(localStorage.getItem(USER_KEY)).toContain(user(2).email);expect(localStorage.getItem('auth:session_id')).toBe('session-2');
  });

  it('discards pending Google sign-in after clearing without contacting the provider',()=>{
    init();const google=TestBed.inject(GoogleAuthService);google.loginWithGoogle('synthetic-id-token');const old=http.expectOne(`${BASE}/users/auth/google-login`);auth.clearAuthState(false);signedIn(2);old.flush(session(1));
    expect(auth.currentUser()?.id).toBe(2);expect(navigate).not.toHaveBeenCalled();expect(toast.success).not.toHaveBeenCalled();
  });

  it('normal Google sign-in still authenticates and navigates',()=>{
    init();const google=TestBed.inject(GoogleAuthService);google.loginWithGoogle('synthetic-id-token');http.expectOne(`${BASE}/users/auth/google-login`).flush(session(1));
    expect(auth.currentUser()?.id).toBe(1);expect(navigate).toHaveBeenCalled();expect(auth.isAuthenticationInProgress()).toBeFalse();
  });

  for(const status of [401,419])it(`a delayed ${status} for A cannot close or redirect B`,()=>{
    init();signedIn(1);client.get(`${BASE}/private-old`).subscribe({error:()=>undefined});const old=http.expectOne(`${BASE}/private-old`);signedIn(2);old.flush({}, {status,statusText:'Expired'});
    expect(auth.currentUser()?.id).toBe(2);expect(navigate).not.toHaveBeenCalled();expect(toast.error).not.toHaveBeenCalled();http.expectNone(`${BASE}/users/refresh-token`);
  });

  it('does not retry A private request after its refresh completes for an obsolete session',()=>{
    init();signedIn(1);client.get(`${BASE}/private-old`).subscribe({error:()=>undefined});http.expectOne(`${BASE}/private-old`).flush({}, {status:401,statusText:'Unauthorized'});
    const old=http.expectOne(`${BASE}/users/refresh-token`);signedIn(2);old.flush(session(1,'session-1','late'));
    http.expectNone(`${BASE}/private-old`);expect(auth.currentUser()?.id).toBe(2);expect(navigate).not.toHaveBeenCalled();
  });

  it('retries a normal 401 once using its own renewed token',()=>{
    init();signedIn(1);let value:unknown;client.get(`${BASE}/private-current`).subscribe(result=>value=result);http.expectOne(`${BASE}/private-current`).flush({}, {status:401,statusText:'Unauthorized'});
    const renewed=session(1,'session-1','renewed');http.expectOne(`${BASE}/users/refresh-token`).flush(renewed);const retry=http.expectOne(`${BASE}/private-current`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer '+renewed.accessToken);expect(retry.request.headers.get('X-Auth-Retry')).toBe('1');retry.flush({ok:true});expect(value).toEqual({ok:true});
  });

  it('an irreversible request marked skip-auth-retry is never replayed',()=>{
    init();signedIn(1);client.post(`${BASE}/private-write`,{}, {context:new HttpContext().set(SKIP_AUTH_RETRY,true)}).subscribe({error:()=>undefined});http.expectOne(`${BASE}/private-write`).flush({}, {status:401,statusText:'Unauthorized'});
    http.expectNone(`${BASE}/users/refresh-token`);http.expectNone(`${BASE}/private-write`);expect(auth.currentUser()).toBeNull();
  });
});
