import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IconModule } from '../../shared/icons/icon.module';


@Component({
  selector: 'app-offers',
  imports: [IconModule, CommonModule, RouterModule],
  templateUrl: './offers.html',
  styleUrl: './offers.css',
})
export class Offers {}
