import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IconModule } from '../../../shared/icons/icon.module';


@Component({
  selector: 'app-help',
  standalone: true,
  imports: [IconModule, CommonModule, RouterModule],
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class HelpPage {}
