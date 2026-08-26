# HMFPV

모임용 앱입니다. 메뉴는 **공지 · 스팟 · 수리 · 3D · 투표**이고, 내용은 가비아 서버 PostgreSQL에 저장됩니다.

API: `https://if.io.kr/haemi-api`

## 앱 실행

```bash
npm start
npm run android
```

## 서버 배포

가비아 클라우드(`ubuntu@121.78.183.225`)에 API와 DB를 올립니다. SSH 키는 `C:\workspace\toolloop\SSH_KeyPair-260716092832.pem` 입니다.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/push-to-gabia.ps1
```

기존 `if.io.kr` 인플루언서 서비스는 그대로 두고, 해미 API만 `/haemi-api`로 붙입니다.

## APK

```bash
npm run apk
```

결과 파일은 `dist/haemi.apk` 입니다.
