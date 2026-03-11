import { PrototypePage } from './prototype/PrototypePage.js';

/**
 * App - 메인 애플리케이션 클래스
 */
export class App {
  private currentPage: PrototypePage | null;

  constructor() {
    this.currentPage = null;
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize(): Promise<void> {
    try {
      await this.loadPage();
    } catch (error) {
      console.error('[App] 초기화 오류:', error);
    }
  }

  /**
   * Prototype 페이지 로드
   */
  private async loadPage(): Promise<void> {
    try {
      if (this.currentPage) {
        this.currentPage.cleanup();
        this.currentPage = null;
      }

      this.currentPage = new PrototypePage();
      await this.currentPage.initialize();
    } catch (error) {
      console.error('[App] Prototype 페이지 로드 오류:', error);
    }
  }
}