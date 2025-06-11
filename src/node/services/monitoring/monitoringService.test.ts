import { monitoringService } from './monitoringService';

describe('MonitoringService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs errors correctly', () => {
    const error = new Error('Test error');
    monitoringService.logError(error);
    // Add assertions based on your implementation
  });
}); 