import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, ListGroup, ListRow, Skeleton, Switch, Text, toast } from '@/components/ui';
import { ShowcaseSection } from './ShowcaseSection';

export function SurfacesShowcase() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [faceId, setFaceId] = useState(true);

  return (
    <ShowcaseSection title={t('dev.sections.surfaces')} note={t('dev.cards.hint')}>
      <Card>
        <Text weight="medium">{t('dev.cards.default')}</Text>
      </Card>
      <Card variant="raised">
        <Text weight="medium">{t('dev.cards.raised')}</Text>
      </Card>
      <Card variant="outline">
        <Text weight="medium">{t('dev.cards.outline')}</Text>
      </Card>
      <Card
        padding="lg"
        selected={selected}
        onPress={() => setSelected((value) => !value)}
        accessibilityLabel={selected ? t('dev.cards.selected') : t('dev.cards.interactive')}
      >
        <Text variant="title">{selected ? t('dev.cards.selected') : t('dev.cards.interactive')}</Text>
      </Card>
      <ListGroup header={t('dev.list.header')} footer={t('dev.list.footer')}>
        <ListRow leadingIcon="language" title={t('dev.list.language')} value={t('dev.list.languageValue')} onPress={() => undefined} />
        <ListRow leadingIcon="tag" title={t('dev.list.currency')} value={t('dev.list.currencyValue')} onPress={() => undefined} />
        <ListRow
          leadingIcon="lock"
          title={t('dev.list.faceId')}
          trailing={<Switch value={faceId} onValueChange={setFaceId} accessibilityLabel={t('dev.list.faceId')} />}
        />
        <ListRow leadingIcon="bell" title={t('dev.list.notifications')} onPress={() => undefined} />
        <ListRow title={t('dev.list.signOut')} destructive onPress={() => toast.show({ message: t('dev.toasts.saved') })} />
      </ListGroup>
      <Card padding="lg" className="gap-3">
        <View className="flex-row items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-pill" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-4/5 rounded-pill" />
            <Skeleton className="h-3 w-3/5 rounded-pill" />
          </View>
        </View>
        <Skeleton className="h-10 w-full rounded-button" />
      </Card>
    </ShowcaseSection>
  );
}
