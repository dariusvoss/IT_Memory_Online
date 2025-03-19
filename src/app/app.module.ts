import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { MenuComponent } from './menu/menu.component';
import { DialogComponent } from './dialog/dialog.component';
import { SizeDialogueComponent } from './size-dialogue/size-dialogue.component';
import { BoardComponent } from './dialog/board/board.component';
import { CardComponent } from './dialog/board/card/card.component';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    AppComponent,
    MenuComponent,
    DialogComponent,
    SizeDialogueComponent,
    BoardComponent,
    CardComponent
  ],
  imports: [
    BrowserModule,
    NgbModule
  ],
  providers: [NgbActiveModal],
  bootstrap: [AppComponent]
})
export class AppModule {}
