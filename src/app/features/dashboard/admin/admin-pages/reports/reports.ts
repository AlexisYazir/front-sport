import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { BackupService } from '../../../../../core/services/backup.service';

interface PlanCard {
  nodeType: string;
  relation?: string;
  cost?: number;
  rows?: number;
  loops?: number;
  actualTime?: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {

 
}