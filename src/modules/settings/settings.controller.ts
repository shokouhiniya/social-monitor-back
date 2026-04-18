import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: string) {
    return this.settingsService.findByCategory(category);
  }

  @Put()
  updateBulk(@Body() updates: { key: string; value: string }[]) {
    return this.settingsService.updateBulk(updates);
  }
}
