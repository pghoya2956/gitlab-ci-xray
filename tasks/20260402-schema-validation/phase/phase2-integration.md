# Phase 2: 통합 + 테스트 + 배포

## Goal

검증 엔진을 analyze 파이프라인에 통합하고, 전체 테스트 통과 후 배포한다.

## Gate (Phase 완료 조건)

- [ ] analyze() 결과에 schema warnings 포함
- [ ] 기존 115+ 테스트 regression 없음
- [ ] CLI/VS Code에서 스키마 경고 표시 확인
- [ ] v0.2.0 npm + Marketplace 배포

## Checklist

- [ ] P2-01: analyze.ts에 validateSchema 통합
- [ ] P2-02: index.ts에 validateSchema export 추가
- [ ] P2-03: 통합 테스트 작성 (analyze() 결과 검증)
- [ ] P2-04: 기존 테스트 전체 실행 + regression 확인
- [ ] P2-05: 엣지 케이스 테스트 (pages 키, anchor/merge key, variables 내부)
- [ ] P2-06: CLI 출력에서 SC- 경고 표시 확인
- [ ] P2-07: VS Code WebView에서 SC- 경고 카드 표시 확인
- [ ] P2-08: VS Code 빌드 + .vsix 패키징 + 번들 크기 확인
- [ ] P2-09: 버전 0.2.0 bump + npm publish + Marketplace 업로드
- [ ] P2-10: CHANGELOG 업데이트

## Dependencies

- Phase 1 완료 (validator 모듈 + 단위 테스트 통과)
