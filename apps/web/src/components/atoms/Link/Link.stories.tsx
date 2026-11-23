import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentPropsWithRef } from 'react';
import { Link } from './Link';

/** Sustituto del `Link` de React Router para la story polimórfica (el átomo no conoce el router). */
function RouterLikeLink({
  to,
  ...props
}: { to: string } & Omit<ComponentPropsWithRef<'a'>, 'href'>) {
  return <a href={to} {...props} />;
}

const meta = {
  title: 'Átomos/Link',
  component: Link,
  args: { href: '#', children: 'Volver al inicio' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'subtle'] },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PorDefecto: Story = {};
export const Sutil: Story = { args: { variant: 'subtle', children: '¿Necesitas ayuda?' } };

/** Dentro de un párrafo, hereda el tamaño del texto. */
export const EnUnTexto: Story = {
  render: (args) => (
    <p className="max-w-prose text-base text-fg">
      La página que buscas no existe. Puedes <Link {...args}>volver al inicio</Link> o revisar la
      dirección.
    </p>
  ),
};

/** Abre otra pestaña: se añade `rel="noopener noreferrer"`. */
export const OtraPestaña: Story = {
  args: { href: 'https://example.com', target: '_blank', children: 'Abrir en otra pestaña' },
};

/** Con `as`, el mismo estilo sobre otro componente (en la app, el `Link` de React Router). */
export const Polimórfico: Story = {
  render: () => (
    <Link as={RouterLikeLink} to="#">
      Enlace pintado con otro componente
    </Link>
  ),
};
