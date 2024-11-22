import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Postagem } from '../../postagem/entities/postagem.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'tb_usuarios' })
export class Usuario {
    
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty()
  @IsNotEmpty()
  @Column({ length: 255, nullable: false })
  nome: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  @Column({ length: 255, nullable: false })
  usuario: string;

  @ApiProperty()
  @MinLength(8)
  @IsNotEmpty()
  @Column({ type: 'varchar', length: 255, nullable: false })
  senha: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 5000, nullable: true })
  foto?: string;

  @OneToMany(() => Postagem, (postagem) => postagem.usuario)
  @ApiProperty()
  postagem: Postagem[];
}
