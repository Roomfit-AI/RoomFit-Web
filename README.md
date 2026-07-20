# RoomFit Web

RoomFit Web은 방을 선택하고 가구·취향을 설정한 뒤, Backend가 추천한 레이아웃을 3D로 확인·편집·확정하는 React 애플리케이션입니다.

## 사용자 흐름

```text
방 선택 또는 업로드
  → 가구·선호 스타일·상품 설정
  → 레이아웃 추천
  → 3D 편집과 자연어 피드백
  → 검증 결과 확인
  → 최종 레이아웃 확정
```

## 주요 기능

- 샘플 방과 업로드한 방을 구분해 선택하고, 현재 사용자 범위에 맞는 레이아웃을 유지
- 가구, 라이프스타일, 디자인 스타일, 색상 및 선택 상품을 추천 요청에 반영
- 추천 결과의 점수·품질·실패 상태를 명확히 표시
- 3D 편집기에서 가구 선택, 이동, 회전, 초기화 및 저장
- 자연어 피드백 결과를 표시하고, 중복 대상은 사람이 읽을 수 있는 후보 버튼으로 선택
- 후보 선택을 재요청하는 동안 중복 실행을 막고, 실패 또는 명확화 응답에서는 현재 레이아웃을 보존
- Backend가 반환한 최신 `layoutId`를 활성 Draft에 반영해 새로고침과 후속 편집을 일관되게 유지
- 추천·피드백·새로고침 전반에서 Backend의 가구 타입과 표현 메타데이터를 보존

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| UI | React 19, TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber, Drei |
| Routing | React Router |
| HTTP | Axios |
| Test | Vitest |

## 시작하기

Node.js의 현재 LTS 버전을 권장합니다.

```bash
npm install
npm run dev
```

개발 서버가 출력하는 주소(기본값 `http://localhost:5173`)를 브라우저에서 엽니다.

### Backend 주소 설정

기본 Backend 주소는 배포 API입니다. 로컬 Backend를 사용할 때는 프로젝트 루트에 `.env.local`을 만들고 다음을 설정합니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080
```

`VITE_`로 시작하는 값은 브라우저 번들에 포함됩니다. API 키나 DB 자격 증명 같은 secret은 이 파일에 넣지 마세요.

## 검증 명령

```bash
npm run test:run
npm run lint
npm run build
```

개발 중 테스트를 계속 실행하려면 `npm test`를 사용합니다.

## Backend 연동 계약

이 앱은 RoomFit Backend의 방, 컨텍스트, 추천, 피드백, 검증, 확정 API를 사용합니다. 피드백은 UI에서 직접 좌표를 결정하지 않고 Backend의 검증된 결과만 적용합니다. 명확화가 필요한 경우에는 후보를 선택해 재요청하며, 내부 가구 식별자는 화면에 표시하지 않습니다.

연동 상세는 Backend 저장소의 [`docs/frontend-api-integration.md`](../RoomFit-Backend/docs/frontend-api-integration.md)를 참조하세요.

## 가구 카탈로그 동기화

Backend 목업 카탈로그를 기준으로 프런트엔드 데이터를 생성해야 할 때 사용합니다.

```bash
npm run catalog:generate
```

이 명령은 기본적으로 인접한 `../RoomFit-Backend` 경로를 사용합니다. 별도 위치에서 실행한다면 스크립트 인자를 조정하세요.
