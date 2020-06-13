import { IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar, IonInput, IonButton, IonToast } from '@ionic/react';
import React, { useState } from 'react';
import { useParams } from 'react-router';
import ExploreContainer from '../components/ExploreContainer';
import './Page.css';

const Page: React.FC = () => {

  const { name } = useParams<{ name: string; }>();
  const [text, setText] = useState<string>();
  const [toast, setToast] = useState('');

  const cmdConnect = async () => {
    // console.log('Connecting ...');
    // console.log(text);
    // if(typeof text === 'string') {
    //   try {
    //     const connId: number = await peeringService.connect(text);
    //     console.log(connId);
    //   } catch(err) {
    //     console.error(err);
    //     setToast('Could not connect!');
    //   }
    // }
  }

  return (
    <IonPage>
      <IonToast
        isOpen={toast !== ''}
        onDidDismiss={() => setToast('')}
        message={toast}
        duration={200}
      />

      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton />
          </IonButtons>
          <IonTitle>{name}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{name}</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonInput value={text} placeholder="Enter Input" onIonChange={e => setText(e.detail.value!)}></IonInput>
        <IonButton onClick={() => cmdConnect()}>Connect</IonButton>

        <ExploreContainer/>
      </IonContent>
    </IonPage>
  );
};

export default Page;
